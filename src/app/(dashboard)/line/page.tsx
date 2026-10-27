import Link from "next/link";
import { listArticles, listLineDrafts } from "@/lib/data/store";
import { LineDraftCreator } from "@/components/line/LineDraftCreator";
import { LINE_STATUS_BADGE_CLASS, LINE_STATUS_LABEL } from "@/lib/ui/badges";

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LinePage() {
  const [drafts, approved, exported] = await Promise.all([
    listLineDrafts(),
    listArticles({ status: "approved" }),
    listArticles({ status: "exported" }),
  ]);
  const articles = [...approved, ...exported]
    .filter((a) => !!a.bodyRewritten)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((a) => ({ id: a.id, title: a.titleRewritten ?? a.titleOriginal }));

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div className="text-[22px] font-bold text-hs-text">LINE文案作成</div>
        <div className="mt-1 text-[13px] text-hs-text-secondary">
          周知したい内容や承認ずみの記事から、LINE公式アカウントで配信する短いメッセージを作ります。
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="flex flex-col gap-8">
          <LineDraftCreator articles={articles} />

          <section>
            <h2 className="mb-3 text-[15px] font-bold text-hs-text">これまでの文案</h2>
            <div className="overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
              {drafts.length === 0 && (
                <div className="px-4.5 py-10 text-center text-sm text-hs-text-secondary">文案はまだありません。</div>
              )}
              {drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/line/${draft.id}`}
                  className="flex items-center gap-4 border-t border-hs-stone-100 px-4.5 py-3.5 first:border-t-0 hover:bg-hs-stone-50"
                >
                  <div className="w-24 shrink-0 text-[13px] text-hs-text-secondary">{draft.createdAt.slice(0, 10)}</div>
                  <div className="min-w-0 flex-1 truncate text-[13px] text-hs-text">{draft.messageText.split("\n")[0]}</div>
                  <span className={"shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] " + LINE_STATUS_BADGE_CLASS[draft.status]}>
                    {LINE_STATUS_LABEL[draft.status]}
                    {draft.status === "scheduled" && draft.scheduledAt && `（${formatJst(draft.scheduledAt)}）`}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
