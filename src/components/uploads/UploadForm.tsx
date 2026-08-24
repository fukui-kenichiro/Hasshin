"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceType } from "@/lib/types/domain";
import { FriendlyError } from "@/components/ui/FriendlyError";

const STAGE_LABEL: Record<string, string> = {
  render_pages: "PDFを画像に変換しています…",
  extract_page: "文章を読み取っています…",
  assemble_articles: "記事のまとまりを判定しています…",
  tag_region: "掲載する地域を判定しています…",
  rewrite: "公開向けの文章に書き直しています…",
  detect_duplicates: "似た記事がないか確認しています…",
};

// 1回の取り込みが止まってしまった場合に無限ループしないようにする上限
const MAX_TICKS = 400;

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceType, setSourceType] = useState<SourceType>("suishin_news");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState<string>("送信しています…");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  async function drainJobs(documentId: string): Promise<void> {
    for (let i = 0; i < MAX_TICKS; i++) {
      const res = await fetch("/api/jobs/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error("tick_failed"), { details: data.message ?? data.error });
      }
      const data = await res.json();
      if (data.jobType) setStageLabel(STAGE_LABEL[data.jobType] ?? "処理しています…");
      if (data.error) {
        throw Object.assign(new Error("job_failed"), { details: data.error });
      }
      if (data.remaining === 0) return;
      if (!data.processed) return; // これ以上処理できるジョブがない
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      setStatus("uploading");
      setStageLabel("送信しています…");
      setCurrentFile(file.name);
      setDoneMessage(null);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceType", sourceType);

      try {
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw Object.assign(new Error("upload_failed"), { details: data.message ?? data.error });
        }
        const { sourceDocumentId } = await res.json();
        await drainJobs(sourceDocumentId);
        setDoneMessage(`「${file.name}」の読み取りが完了しました。`);
      } catch (err) {
        setStatus("error");
        const details = err instanceof Error ? (err as Error & { details?: string }).details : undefined;
        setError({
          message: `「${file.name}」の処理に失敗しました。もう一度お試しいただくか、SNS対策部にご連絡ください。`,
          details,
        });
        return;
      }
    }

    setStatus("done");
    router.refresh();
  }

  const isUploading = status === "uploading";

  return (
    <div className="flex flex-col gap-3.5">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!isUploading) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={
          "flex flex-col items-center gap-3 rounded-[10px] border-2 border-dashed px-6 py-12 " +
          (isUploading
            ? "border-hs-stone-300 bg-hs-stone-50"
            : "cursor-pointer border-hs-stone-400 bg-white hover:bg-hs-stone-50")
        }
      >
        {isUploading ? (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-hs-stone-200 border-t-hs-primary" />
            <div className="text-[15px] font-bold text-hs-text">
              「{currentFile}」を処理しています
            </div>
            <div className="text-[13px] text-hs-text-secondary">{stageLabel}</div>
            <div className="text-[12px] text-hs-stone-400">
              このまま画面を閉じずにお待ちください（数十秒〜数分かかります）
            </div>
          </>
        ) : (
          <>
            <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
              <path d="M10 13V4M10 4L6.5 7.5M10 4l3.5 3.5" stroke="var(--color-hs-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 13.5v1.8a1.7 1.7 0 0 0 1.7 1.7h8.6a1.7 1.7 0 0 0 1.7-1.7v-1.8" stroke="var(--color-hs-primary)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className="text-[15px] font-bold text-hs-text">
              ここをクリックしてPDFファイルを選ぶ
            </div>
            <div className="text-[13px] text-hs-text-secondary">
              ファイルをこの枠の中にドラッグして離しても取り込めます。複数ファイルもまとめて選べます。
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          disabled={isUploading}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-bold text-hs-text">ニュースの種類</label>
        <div className="flex gap-2.5">
          <button
            disabled={isUploading}
            onClick={() => setSourceType("suishin_news")}
            className={
              "rounded-full border px-3.5 py-1.5 text-[13px] disabled:opacity-60 " +
              (sourceType === "suishin_news"
                ? "border-hs-kitatama-border bg-hs-kitatama-bg font-bold text-hs-kitatama-text"
                : "border-hs-stone-300 text-hs-text-secondary")
            }
          >
            北多摩東部地区推進ニュース
          </button>
          <button
            disabled={isUploading}
            onClick={() => setSourceType("ganbaru_news")}
            className={
              "rounded-full border px-3.5 py-1.5 text-[13px] disabled:opacity-60 " +
              (sourceType === "ganbaru_news"
                ? "border-hs-kodaira-border bg-hs-kodaira-bg font-bold text-hs-kodaira-text"
                : "border-hs-stone-300 text-hs-text-secondary")
            }
          >
            がんばるニュース（小平市委員会）
          </button>
        </div>
        <div className="mt-0.5 text-[12px] text-hs-stone-400">
          種類によって、掲載する地域の初期判定が変わります。西東京に関する記事は推進ニュースの中から自動で見つけます。
        </div>
      </div>

      {status === "error" && error && <FriendlyError message={error.message} details={error.details} />}

      {status === "done" && doneMessage && (
        <div className="rounded-md border border-hs-success-border bg-hs-success-bg px-3.5 py-2.5 text-[13px] text-hs-success-text">
          {doneMessage} 「確認待ちの記事」の一覧から内容を確認してください。
        </div>
      )}
    </div>
  );
}
