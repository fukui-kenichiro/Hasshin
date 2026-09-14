"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  Article,
  DuplicateFlag,
  InternalInfoFlag,
  RegionTag,
  SourceDocument,
} from "@/lib/types/domain";
import {
  DUPLICATE_FLAG_LABEL,
  REGION_BADGE_CLASS,
  REGION_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  SUITABILITY_BADGE_CLASS,
  SUITABILITY_LABEL,
  WP_PUBLISH_STATUS_BADGE_CLASS,
  WP_PUBLISH_STATUS_LABEL,
} from "@/lib/ui/badges";
import { buildHighlightSegments } from "@/lib/ui/highlight";
import { FriendlyError } from "@/components/ui/FriendlyError";

const REGION_OPTIONS: RegionTag[] = [
  "kitatama_tobu",
  "nishitokyo",
  "kodaira",
  "multiple",
  "undetermined",
];

const CATEGORY_LABEL: Record<InternalInfoFlag["category"], string> = {
  membership_count: "党員数",
  dues_rate: "党費納入率",
  reader_count: "読者数",
  fundraising_rate: "募金到達率",
  internal_directive: "内部連絡事項",
  member_only_label: "党員限定の明記",
  personal_privacy: "個人のプライバシー",
  other: "その他",
};

export function ArticleEditView({
  article,
  sourceDocument,
  internalInfoFlags,
  duplicateFlags,
  prevArticleId,
  nextArticleId,
  fromStatus,
}: {
  article: Article;
  sourceDocument: SourceDocument | null;
  internalInfoFlags: InternalInfoFlag[];
  duplicateFlags: DuplicateFlag[];
  prevArticleId: string | null;
  nextArticleId: string | null;
  fromStatus: Article["status"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [exportError, setExportError] = useState<{ message: string; details?: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(article.titleRewritten ?? "");
  const [draftBody, setDraftBody] = useState(article.bodyRewritten ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [showForceRewrite, setShowForceRewrite] = useState(false);
  const [rewriteCondition, setRewriteCondition] = useState("");
  const [isForceRewriting, setIsForceRewriting] = useState(false);
  const [forceRewriteError, setForceRewriteError] = useState<string | null>(null);

  const unresolvedCount = internalInfoFlags.filter((f) => f.status === "unresolved").length;
  const openDuplicates = duplicateFlags.filter((f) => f.status === "open");
  const isApprovedOrExported = article.status === "approved" || article.status === "exported";
  const canExport = isApprovedOrExported && unresolvedCount === 0 && !!article.bodyRewritten;

  function refresh() {
    router.refresh();
  }

  async function callApi(url: string, options: RequestInit) {
    const res = await fetch(url, options);
    startTransition(() => refresh());
    return res;
  }

  // 承認直後にWordPressへの送信ジョブが積まれるので、
  // ジョブキューを数回叩いて処理を進めておく（放っておいても
  // 巡回ジョブでいずれ処理されるが、すぐに結果を見せたいため）。
  async function drainJobTicks(times: number) {
    for (let i = 0; i < times; i++) {
      try {
        await fetch("/api/jobs/tick", { method: "POST" });
      } catch {
        break;
      }
    }
  }

  async function handleApprove() {
    await callApi(`/api/articles/${article.id}/approve`, { method: "POST" });
    await drainJobTicks(3);
    refresh();
  }
  async function handleReject() {
    await callApi(`/api/articles/${article.id}/reject`, { method: "POST" });
  }
  async function handleResendToWp() {
    setIsResending(true);
    try {
      await callApi(`/api/articles/${article.id}/publish-to-wp`, { method: "POST" });
      await drainJobTicks(3);
      refresh();
    } finally {
      setIsResending(false);
    }
  }
  async function handleForceRewrite() {
    setForceRewriteError(null);
    if (!rewriteCondition.trim()) {
      setForceRewriteError("条件を入力してください");
      return;
    }
    setIsForceRewriting(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/force-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: rewriteCondition }),
      });
      if (!res.ok) {
        setForceRewriteError("リライトの開始に失敗しました。もう一度お試しください。");
        return;
      }
      await drainJobTicks(3);
      setShowForceRewrite(false);
      setRewriteCondition("");
      refresh();
    } finally {
      setIsForceRewriting(false);
    }
  }

  async function handleDeleteForever() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/articles/${article.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.warning) {
          setDeleteWarning(data.warning);
          setIsDeleting(false);
          return;
        }
        router.push(`/?status=${fromStatus}`);
        router.refresh();
      } else {
        setIsDeleting(false);
      }
    } catch {
      setIsDeleting(false);
    }
  }
  async function handleRegionChange(regionTag: RegionTag) {
    await callApi(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionTag }),
    });
  }
  async function handleResolveFlag(flagId: string, status: "confirmed_safe" | "removed") {
    if (status === "removed") {
      const flag = internalInfoFlags.find((f) => f.id === flagId);
      if (flag && article.bodyRewritten?.includes(flag.quotedText)) {
        const newBody = article.bodyRewritten.replace(flag.quotedText, "");
        await fetch(`/api/articles/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyRewritten: newBody }),
        });
      }
    }
    await callApi(`/api/articles/${article.id}/internal-info-flags/${flagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }
  async function handleDuplicateAction(flagId: string, status: "confirmed" | "dismissed") {
    await callApi(`/api/articles/${article.id}/duplicate-flags/${flagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (status === "confirmed") {
      await handleReject();
    }
  }
  async function handleExport(format: "html" | "markdown" | "plain_text") {
    setExportError(null);
    const res = await fetch(`/api/export/${article.id}?format=${format}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setExportError({
        message: data.message ?? "書き出しに失敗しました。もう一度お試しください。",
      });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    refresh();
  }

  function startEditing() {
    setDraftTitle(article.titleRewritten ?? article.titleOriginal);
    setDraftBody(article.bodyRewritten ?? "");
    setIsEditing(true);
  }
  async function saveEditing() {
    setIsSaving(true);
    await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleRewritten: draftTitle, bodyRewritten: draftBody }),
    });
    setIsSaving(false);
    setIsEditing(false);
    refresh();
  }

  const displayTitle = article.titleRewritten ?? article.titleOriginal;
  const segments = article.bodyRewritten
    ? buildHighlightSegments(article.bodyRewritten, internalInfoFlags)
    : [];

  // リライト前の記事では「条件付きで書き直す」、リライト後の記事では
  // 「修正を指示する」として、同じ仕組み（条件をAIへの追加指示として渡し、
  // rewriteジョブを再実行する）を使う。
  function renderRewriteConditionControl(buttonLabel: string) {
    return !showForceRewrite ? (
      <button
        onClick={() => setShowForceRewrite(true)}
        className="self-start rounded-md border border-hs-primary px-3.5 py-1.5 text-[12px] font-bold text-hs-primary hover:bg-hs-stone-50"
      >
        {buttonLabel}
      </button>
    ) : (
      <div className="flex flex-col gap-2 rounded-md border border-hs-stone-300 bg-hs-stone-50 p-3">
        <label className="text-[12px] font-bold text-hs-text-secondary">
          条件（例: 「団体名は伏せて」「この部分は削らず残して」など、AIへの追加指示）
        </label>
        <textarea
          value={rewriteCondition}
          onChange={(e) => setRewriteCondition(e.target.value)}
          placeholder="書き直しの条件を入力してください"
          className="min-h-[80px] rounded border border-hs-stone-300 bg-white p-2.5 text-sm leading-7 text-hs-text outline-none focus:border-hs-primary"
        />
        {forceRewriteError && <FriendlyError message={forceRewriteError} />}
        <div className="flex gap-2">
          <button
            onClick={handleForceRewrite}
            disabled={isForceRewriting}
            className="rounded-md bg-hs-primary px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
          >
            {isForceRewriting ? "実行中…" : "実行"}
          </button>
          <button
            onClick={() => {
              setShowForceRewrite(false);
              setForceRewriteError(null);
            }}
            disabled={isForceRewriting}
            className="rounded-md border border-hs-stone-300 bg-white px-3.5 py-1.5 text-[12px] text-hs-text-secondary"
          >
            やめる
          </button>
        </div>
      </div>
    );
  }

  if (deleteWarning) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-[16px] font-bold text-hs-text">この記事はハッシンから完全に削除されました。</div>
        <div className="max-w-md rounded-md border border-hs-warn-border bg-hs-warn-bg px-4 py-3 text-[13px] leading-relaxed text-hs-warn-text">
          {deleteWarning}
        </div>
        <Link
          href={`/?status=${fromStatus}`}
          className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark"
        >
          一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href={`/?status=${fromStatus}`} className="text-[12px] text-hs-text-secondary hover:text-hs-link">
            ← 「{STATUS_LABEL[fromStatus]}」の一覧に戻る
          </Link>
          <div className="flex gap-2">
            <Link
              href={prevArticleId ? `/articles/${prevArticleId}?from=${fromStatus}` : "#"}
              aria-disabled={!prevArticleId}
              className={
                "rounded-md border border-hs-stone-300 px-3 py-1.5 text-[12px] " +
                (prevArticleId ? "text-hs-text-secondary hover:bg-hs-stone-50" : "pointer-events-none text-hs-text-disabled")
              }
            >
              ← 前の記事
            </Link>
            <Link
              href={nextArticleId ? `/articles/${nextArticleId}?from=${fromStatus}` : "#"}
              aria-disabled={!nextArticleId}
              className={
                "rounded-md border border-hs-stone-300 px-3 py-1.5 text-[12px] " +
                (nextArticleId ? "text-hs-text-secondary hover:bg-hs-stone-50" : "pointer-events-none text-hs-text-disabled")
              }
            >
              次の記事 →
            </Link>
          </div>
        </div>
        <div className="mt-2 flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[19px] font-bold text-hs-text">{displayTitle}</span>
              <span className={"rounded-full border px-2.5 py-0.5 text-[12px] " + STATUS_BADGE_CLASS[article.status]}>
                {STATUS_LABEL[article.status]}
              </span>
              <span className={"rounded-full border px-2.5 py-0.5 text-[12px] " + SUITABILITY_BADGE_CLASS[article.publicSuitability]}>
                {SUITABILITY_LABEL[article.publicSuitability]}
              </span>
            </div>
            <div className="mt-1.5 text-[12px] text-hs-stone-400">
              出典: {sourceDocument?.originalFilename ?? "-"}（{article.sourcePages.join(",")}ページ目）
              {article.derivedFromArticleId && "　/　西東京向けに自動で作られた記事です"}
            </div>
          </div>
          <div className="ml-5 flex shrink-0 gap-2.5">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="rounded-md border border-hs-danger px-4 py-2 text-[13px] font-bold text-hs-danger hover:bg-hs-danger-bg disabled:opacity-50"
            >
              却下する
            </button>
            <button
              onClick={handleApprove}
              disabled={isPending || isApprovedOrExported}
              className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
            >
              承認する
            </button>
            <div className="relative group">
              <button
                disabled={!canExport}
                className="flex items-center gap-1.5 rounded-md bg-hs-stone-100 px-4 py-2 text-[13px] font-bold text-hs-stone-600 disabled:cursor-not-allowed disabled:text-hs-text-disabled"
              >
                書き出す
              </button>
              {canExport && (
                <div className="absolute right-0 z-10 mt-1 hidden w-48 flex-col gap-0.5 rounded-md border border-hs-stone-300 bg-white p-1.5 shadow-md group-hover:flex">
                  <button onClick={() => handleExport("html")} className="rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-hs-stone-50">ホームページ用（HTML）</button>
                  <button onClick={() => handleExport("markdown")} className="rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-hs-stone-50">下書き用（Markdown）</button>
                  <button onClick={() => handleExport("plain_text")} className="rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-hs-stone-50">文字のみ（テキスト）</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-hs-stone-300 bg-hs-stone-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-hs-text-secondary">
          <span className="font-bold text-hs-text">「承認する」</span>＝この記事をホームページに公開してよいと判断したとき。
          <span className="ml-3 font-bold text-hs-text">「却下する」</span>＝この記事は公開しない、と判断したとき。
          {article.publicSuitability === "not_suitable_internal_only" && (
            <div className="mt-1.5 font-bold text-hs-danger-text">
              ※AIはこの記事を「党内限定の内容」と判定しました。内容をよく確認し、公開してよいと思ったときだけ「承認する」を押してください。公開しない場合は「却下する」を押すか、そのままにしておいて構いません。
            </div>
          )}
        </div>

        {!canExport && (
          <div className="mt-2 text-[11px] text-hs-stone-400">
            {!isApprovedOrExported
              ? "書き出す（ホームページ用のファイルを作る）には、先に「承認する」を押してください。"
              : unresolvedCount > 0
                ? `内部情報のうち、まだ確認していないものが${unresolvedCount}件あります。すべて確認すると書き出せるようになります。`
                : ""}
          </div>
        )}
        {article.status === "exported" && (
          <div className="mt-2 text-[11px] text-hs-success-text">この記事はすでに書き出しずみです。もう一度書き出すこともできます。</div>
        )}
        {exportError && (
          <div className="mt-2">
            <FriendlyError message={exportError.message} details={exportError.details} />
          </div>
        )}
      </div>

      {openDuplicates.map((dup) => (
        <div key={dup.id} className="flex items-center gap-3.5 border-b border-hs-warn-border bg-hs-warn-bg px-8 py-3">
          <div className="flex-1 text-[13px] leading-relaxed text-hs-warn-text">
            <span className="font-bold">{DUPLICATE_FLAG_LABEL[dup.flagType]}を見つけました：</span>
            過去の記事「{dup.similarArticleTitle}」と内容が近いようです（似ている度合い {Math.round(dup.similarityScore * 100)}%）。
            {dup.similarityReason}
            <span className="font-bold"> {dup.recommendedAction}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => handleDuplicateAction(dup.id, "confirmed")}
              className="rounded-md border border-hs-warn-border bg-white px-3.5 py-1.5 text-[12px] font-bold text-hs-warn-text hover:bg-hs-warn-bg"
            >
              確認して却下する
            </button>
            <button
              onClick={() => handleDuplicateAction(dup.id, "dismissed")}
              className="rounded-md px-2.5 py-1.5 text-[12px] text-hs-warn-text underline"
            >
              重複ではない（そのまま進める）
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-1 gap-5 overflow-hidden px-8 py-5">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
          <div className="bg-hs-stone-100 px-4 py-2.5 text-[12px] font-bold text-hs-stone-600">
            もとの文章（PDFから読み取った内容）
          </div>
          <div className="flex-1 overflow-auto whitespace-pre-wrap p-4 text-sm leading-8 text-hs-text">
            {article.bodyOriginal}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
          <div className="flex items-center justify-between bg-hs-stone-100 px-4 py-2.5">
            <span className="text-[12px] font-bold text-hs-stone-600">書き直した文章（ホームページに載せる内容）</span>
            {isEditing ? (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="rounded px-2.5 py-1 text-[12px] text-hs-text-secondary hover:bg-white"
                >
                  やめる
                </button>
                <button
                  onClick={saveEditing}
                  disabled={isSaving}
                  className="rounded bg-hs-primary px-3 py-1 text-[12px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-60"
                >
                  {isSaving ? "保存中…" : "保存する"}
                </button>
              </div>
            ) : (
              <button
                onClick={startEditing}
                className="flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-bold text-hs-primary hover:bg-white"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M14.2 3.3a1.5 1.5 0 0 1 2.1 2.1L7.5 14.2l-3 .8.8-3 8.9-8.9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                手直しする
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="flex flex-1 flex-col gap-2 overflow-auto p-4">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="タイトル"
                className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm font-bold text-hs-text outline-none focus:border-hs-primary"
              />
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="本文をここに書いてください"
                className="min-h-[300px] flex-1 rounded border border-hs-stone-300 p-2.5 text-sm leading-8 text-hs-text outline-none focus:border-hs-primary"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto whitespace-pre-wrap p-4 text-sm leading-8 text-hs-text">
              {article.bodyRewritten ? (
                <div className="flex flex-col gap-3">
                  <div>
                    {segments.map((seg, i) =>
                      seg.flag ? (
                        <mark
                          key={i}
                          className={
                            seg.flag.status === "unresolved"
                              ? "rounded-[2px] border-b-2 border-hs-danger bg-hs-danger-bg px-0.5"
                              : "rounded-[2px] border-b-2 border-hs-success-border bg-hs-success-bg px-0.5"
                          }
                        >
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </div>
                  {renderRewriteConditionControl("修正を指示する")}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <span className="text-hs-text-disabled">
                    この記事は「{SUITABILITY_LABEL[article.publicSuitability]}」と判定されたため、書き直しは自動では行っていません。「手直しする」を押すと、ここに直接文章を書いて公開することもできます。
                  </span>
                  {renderRewriteConditionControl("条件付きで書き直す")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex w-[300px] shrink-0 flex-col gap-4 overflow-auto">
          <div className="rounded-lg border border-hs-stone-300 bg-white p-4">
            <div className="mb-2.5 text-[12px] font-bold text-hs-stone-600">掲載する地域</div>
            <div className="flex flex-wrap gap-2">
              {REGION_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleRegionChange(tag)}
                  className={
                    "rounded-full border px-3 py-1 text-[12px] " +
                    REGION_BADGE_CLASS[tag] +
                    (article.regionTag === tag ? " font-bold ring-1 ring-inset ring-current" : " opacity-60")
                  }
                >
                  {REGION_LABEL[tag]}
                  {article.regionTag === tag && " ✓"}
                </button>
              ))}
            </div>
            {article.targetSiteSlug && (
              <div className="mt-2 text-[11px] text-hs-stone-400">
                掲載先: {article.targetSiteSlug}
              </div>
            )}
          </div>

          {isApprovedOrExported && (
            <div className="rounded-lg border border-hs-stone-300 bg-white p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[12px] font-bold text-hs-stone-600">WordPressへの送信</span>
                <span
                  className={
                    "rounded-full border px-2 py-0.5 text-[11px] " +
                    WP_PUBLISH_STATUS_BADGE_CLASS[article.wpPublishStatus]
                  }
                >
                  {WP_PUBLISH_STATUS_LABEL[article.wpPublishStatus]}
                </span>
              </div>

              {article.wpPublishStatus === "sent" && article.wpPostUrl && (
                <a
                  href={article.wpPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-hs-link underline"
                >
                  WordPressの下書きを確認する →
                </a>
              )}

              {(article.wpPublishStatus === "error" || article.wpPublishStatus === "blocked") &&
                article.wpPublishError && (
                  <div className="mb-2 text-[11px] leading-relaxed text-hs-danger-text">
                    {article.wpPublishError}
                  </div>
                )}

              {article.wpPublishStatus !== "pending" && (
                <button
                  onClick={handleResendToWp}
                  disabled={isResending}
                  className="mt-1 rounded border border-hs-stone-300 px-3 py-1.5 text-[11px] font-bold text-hs-text-secondary hover:bg-hs-stone-50 disabled:opacity-50"
                >
                  {isResending ? "送信中…" : article.wpPublishStatus === "sent" ? "再送信する" : "送信する"}
                </button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-hs-stone-300 bg-white p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-bold text-hs-stone-600">内部情報の確認</span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] " +
                  (unresolvedCount > 0 ? "bg-hs-danger-bg text-hs-danger-text" : "bg-hs-success-bg text-hs-success-text")
                }
              >
                {unresolvedCount > 0 ? `未確認 ${unresolvedCount}件` : "すべて確認ずみ"}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {internalInfoFlags.length === 0 && (
                <div className="text-[12px] text-hs-text-secondary">見つかった内部情報はありません。</div>
              )}
              {internalInfoFlags.map((flag) => (
                <div
                  key={flag.id}
                  className={
                    "rounded-md border p-2.5 " +
                    (flag.status === "unresolved"
                      ? "border-hs-danger-border bg-hs-danger-bg"
                      : "border-hs-success-border bg-hs-success-bg")
                  }
                >
                  <div
                    className={
                      "text-[11px] font-bold " +
                      (flag.status === "unresolved" ? "text-hs-danger-text" : "text-hs-success-text")
                    }
                  >
                    {flag.status === "unresolved" ? "未確認" : flag.status === "removed" ? "除いてあります" : "確認ずみ"}
                    　{CATEGORY_LABEL[flag.category]}
                  </div>
                  <div className="my-1.5 text-[12px] leading-relaxed text-hs-text">「{flag.quotedText}」</div>
                  <div className="mb-1 text-[11px] text-hs-stone-600">{flag.reason}</div>
                  {flag.status === "unresolved" && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleResolveFlag(flag.id, "removed")}
                        className="flex-1 rounded bg-hs-danger px-0 py-1.5 text-[11px] font-bold text-white"
                      >
                        文章から消す
                      </button>
                      <button
                        onClick={() => handleResolveFlag(flag.id, "confirmed_safe")}
                        className="flex-1 rounded border border-hs-stone-300 bg-white px-0 py-1.5 text-[11px] text-hs-text-secondary"
                      >
                        このままでよい
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 text-[11px] leading-relaxed text-hs-stone-400">
              確認していない項目が残っている間は、書き出しができません。
            </div>
          </div>

          <div className="rounded-lg border border-hs-danger-border bg-white p-4">
            <div className="mb-1.5 text-[12px] font-bold text-hs-danger-text">完全削除</div>
            <div className="mb-2.5 text-[11px] leading-relaxed text-hs-stone-400">
              重大な個人情報などが含まれていた場合の事故対応用です。承認・却下・書き出しずみかに関わらず、この記事をハッシンから完全に削除します（元に戻せません）。WordPressに下書きを送信ずみの場合は、その下書きも一緒に削除します。
            </div>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded border border-hs-danger px-3 py-1.5 text-[11px] font-bold text-hs-danger hover:bg-hs-danger-bg"
              >
                この記事を完全に削除する
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-hs-danger-border bg-hs-danger-bg p-2.5">
                <div className="text-[11px] font-bold text-hs-danger-text">
                  本当に完全に削除しますか？この操作は元に戻せません。
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleDeleteForever}
                    disabled={isDeleting}
                    className="flex-1 rounded bg-hs-danger px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {isDeleting ? "削除中…" : "完全に削除する"}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={isDeleting}
                    className="flex-1 rounded border border-hs-stone-300 bg-white px-2 py-1.5 text-[11px] text-hs-text-secondary"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
