import Link from "next/link";
import {
  getSourceDocumentById,
  hasUnresolvedInternalInfo,
  listArticles,
  listDuplicateFlags,
} from "@/lib/data/store";
import {
  REGION_BADGE_CLASS,
  REGION_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  SUITABILITY_LABEL,
} from "@/lib/ui/badges";
import type { ArticleStatus, RegionTag } from "@/lib/types/domain";

const STATUS_TABS: { value: ArticleStatus; label: string }[] = [
  { value: "pending_review", label: "確認待ち" },
  { value: "approved", label: "承認ずみ" },
  { value: "rejected", label: "却下ずみ" },
];

const REGION_FILTERS: { value: RegionTag | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "kitatama_tobu", label: "北多摩東部" },
  { value: "nishitokyo", label: "西東京" },
  { value: "kodaira", label: "小平" },
];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; region?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as ArticleStatus) ?? "pending_review";
  const region = (params.region as RegionTag | undefined) ?? undefined;

  const [articles, pendingArticles] = await Promise.all([
    listArticles({ status, regionTag: region }),
    listArticles({ status: "pending_review" }),
  ]);
  const pendingCount = pendingArticles.length;

  const rows = await Promise.all(
    articles.map(async (article) => {
      const [doc, dupFlags, unresolvedInternal] = await Promise.all([
        getSourceDocumentById(article.sourceDocumentId),
        listDuplicateFlags(article.id),
        hasUnresolvedInternalInfo(article.id),
      ]);
      return {
        article,
        doc,
        hasDupOpen: dupFlags.some((f) => f.status === "open"),
        unresolvedInternal,
      };
    })
  );

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-end justify-between border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div>
          <div className="text-[22px] font-bold text-hs-text">確認待ちの記事</div>
          <div className="mt-1 text-[13px] text-hs-text-secondary">
            AIが読み取り・書き直した記事を確認し、公開してよいか判断してください。
          </div>
        </div>
        <div className="text-[13px] text-hs-text-secondary">
          確認待ち <span className="font-bold text-hs-text">{pendingCount}</span> 件
        </div>
      </div>

      <div className="flex gap-6 border-b border-hs-stone-300 bg-white px-8 pt-4">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/?status=${tab.value}${region ? `&region=${region}` : ""}`}
            className={
              "pb-3 text-sm " +
              (status === tab.value
                ? "border-b-2 border-hs-primary font-bold text-hs-primary"
                : "text-hs-text-secondary")
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 px-8 pt-4.5">
        <span className="mr-1 text-[12px] text-hs-text-secondary">地域:</span>
        {REGION_FILTERS.map((r) => {
          const active = (region ?? "all") === r.value;
          return (
            <Link
              key={r.value}
              href={`/?status=${status}${r.value === "all" ? "" : `&region=${r.value}`}`}
              className={
                "rounded-full border px-3 py-1 text-[13px] " +
                (active
                  ? "border-hs-text bg-hs-text text-white"
                  : r.value === "all"
                    ? "border-hs-stone-300 text-hs-text-secondary"
                    : REGION_BADGE_CLASS[r.value as RegionTag])
              }
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto px-8 pt-4.5 pb-7">
        <div className="overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
          <div className="grid grid-cols-[3fr_1.3fr_1fr_1.6fr_1fr] bg-hs-stone-100 px-4.5 py-2.5 text-[12px] font-bold text-hs-stone-600">
            <div>タイトル</div>
            <div>出典（元のファイル）</div>
            <div>地域</div>
            <div>注意事項</div>
            <div></div>
          </div>

          {rows.length === 0 && (
            <div className="px-4.5 py-10 text-center text-sm text-hs-text-secondary">
              該当する記事はありません。
            </div>
          )}

          {rows.map(({ article, doc, hasDupOpen, unresolvedInternal }) => {
            const displayTitle = article.titleRewritten ?? article.titleOriginal;

            return (
              <Link
                key={article.id}
                href={`/articles/${article.id}?from=${status}`}
                className="grid grid-cols-[3fr_1.3fr_1fr_1.6fr_1fr] items-center border-t border-hs-stone-100 px-4.5 py-4 hover:bg-hs-stone-50"
              >
                <div className="min-w-0 pr-4">
                  <div className="truncate text-sm font-bold text-hs-text">{displayTitle}</div>
                  <div className="mt-0.5 truncate text-[12px] text-hs-stone-400">
                    {article.derivedFromArticleId ? "西東京向け派生記事" : article.publicSuitabilityReason}
                  </div>
                </div>
                <div className="text-[13px] text-hs-text-secondary">
                  {doc?.originalFilename ?? "-"}
                </div>
                <div>
                  <span
                    className={
                      "rounded-full border px-2.5 py-0.5 text-[12px] whitespace-nowrap " +
                      REGION_BADGE_CLASS[article.regionTag]
                    }
                  >
                    {REGION_LABEL[article.regionTag]}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {hasDupOpen && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-hs-warn-text">
                      類似記事あり
                    </span>
                  )}
                  {unresolvedInternal && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-hs-danger-text">
                      要確認：内部情報
                    </span>
                  )}
                  {article.publicSuitability === "not_suitable_internal_only" && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-hs-danger-text">
                      {SUITABILITY_LABEL[article.publicSuitability]}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={
                      "inline-block rounded-full border px-3 py-1 text-[12px] font-bold " +
                      STATUS_BADGE_CLASS[article.status]
                    }
                  >
                    {STATUS_LABEL[article.status]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
