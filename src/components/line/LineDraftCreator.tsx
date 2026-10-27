"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FriendlyError } from "@/components/ui/FriendlyError";

type Mode = "manual" | "article";

export function LineDraftCreator({ articles }: { articles: { id: string; title: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");
  const [sourceText, setSourceText] = useState("");
  const [articleId, setArticleId] = useState("");
  const [note, setNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  const canSubmit = mode === "manual" ? !!sourceText.trim() : !!articleId;

  async function handleCreate() {
    setError(null);
    setIsCreating(true);
    try {
      const res = await fetch("/api/line-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "manual" ? { sourceText } : { articleId, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "文案の作成に失敗しました", details: data.details });
        return;
      }
      router.push(`/line/${data.id}`);
    } catch {
      setError({ message: "通信に失敗しました。もう一度お試しください。" });
    } finally {
      setIsCreating(false);
    }
  }

  const tabClass = (active: boolean) =>
    "rounded-md px-3.5 py-1.5 text-[13px] " +
    (active ? "bg-hs-text font-bold text-white" : "border border-hs-stone-300 text-hs-text-secondary hover:bg-hs-stone-50");

  return (
    <section className="max-w-2xl rounded-lg border border-hs-stone-300 bg-white p-5">
      <h2 className="mb-3 text-[15px] font-bold text-hs-text">新しい文案を作る</h2>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setMode("manual")} className={tabClass(mode === "manual")}>
          下書きを書く
        </button>
        <button onClick={() => setMode("article")} className={tabClass(mode === "article")}>
          承認ずみの記事から選ぶ
        </button>
      </div>

      {mode === "manual" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-bold text-hs-text">周知したいこと・URLなど</label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder={"例）9/20(土)14時から、○○会館で演説会を開きます。参加無料・申込不要。\nhttps://example.com/event"}
            className="min-h-[140px] rounded border border-hs-stone-300 p-2.5 text-sm leading-7 text-hs-text outline-none focus:border-hs-primary"
          />
          <div className="text-[12px] text-hs-stone-400">箇条書きやメモ書きのままで構いません。URLはそのまま文案に残ります。</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-hs-text">記事</label>
            <select
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              className="rounded border border-hs-stone-300 bg-white px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
            >
              <option value="">選んでください</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            {articles.length === 0 && (
              <div className="text-[12px] text-hs-stone-400">選べる記事（承認ずみで書き直しのあるもの）がまだありません。</div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-hs-text">記事のURL・補足（任意）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="公開した記事のURLなど、メッセージに入れたいものを書いてください"
              className="min-h-[70px] rounded border border-hs-stone-300 p-2.5 text-sm leading-7 text-hs-text outline-none focus:border-hs-primary"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <FriendlyError message={error.message} details={error.details} />
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!canSubmit || isCreating}
        className="mt-4 rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
      >
        {isCreating ? "文案を作っています…（10〜20秒ほどかかります）" : "LINE用の文案を作る"}
      </button>
    </section>
  );
}
