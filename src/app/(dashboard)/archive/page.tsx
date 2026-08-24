import Link from "next/link";
import { getSourceDocumentById, listArticles, listSites } from "@/lib/data/store";
import { REGION_BADGE_CLASS, REGION_LABEL } from "@/lib/ui/badges";
import type { RegionTag } from "@/lib/types/domain";

const REGION_FILTERS: { value: RegionTag | "all"; label: string }[] = [
  { value: "all", label: "すべての地域" },
  { value: "kitatama_tobu", label: "北多摩東部" },
  { value: "nishitokyo", label: "西東京" },
  { value: "kodaira", label: "小平" },
];

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const region = params.region as RegionTag | undefined;

  const [approved, exported, sites] = await Promise.all([
    listArticles({ status: "approved" }),
    listArticles({ status: "exported" }),
    listSites(),
  ]);
  const items = [...approved, ...exported]
    .filter((a) => !region || a.regionTag === region)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const counts = sites.map((site) => ({
    site,
    count: [...approved, ...exported].filter((a) => a.targetSiteSlug === site.slug).length,
  }));

  const rows = await Promise.all(
    items.map(async (article) => ({
      article,
      doc: await getSourceDocumentById(article.sourceDocumentId),
    }))
  );

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div className="text-[22px] font-bold text-hs-text">公開した記事</div>
        <div className="mt-1 text-[13px] text-hs-text-secondary">
          これまでに承認・公開した記事を、地域や日付ごとに確認できます。
        </div>
      </div>

      <div className="flex gap-3 px-8 pt-4.5">
        {counts.map(({ site, count }) => (
          <div key={site.id} className="flex flex-1 items-center justify-between rounded-lg border border-hs-stone-300 bg-white px-4.5 py-3.5">
            <span className="text-[13px] text-hs-text-secondary">{site.name}</span>
            <span className="text-[20px] font-bold text-hs-primary">
              {count}
              <span className="text-[12px] font-normal text-hs-stone-400"> 件</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-8 pt-4.5">
        {REGION_FILTERS.map((r) => {
          const active = (region ?? "all") === r.value;
          return (
            <Link
              key={r.value}
              href={r.value === "all" ? "/archive" : `/archive?region=${r.value}`}
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

      <div className="flex-1 overflow-auto px-8 py-4.5">
        <div className="overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
          <div className="grid grid-cols-[1fr_3fr_1fr_1fr] bg-hs-stone-100 px-4.5 py-2.5 text-[12px] font-bold text-hs-stone-600">
            <div>更新日</div>
            <div>タイトル</div>
            <div>地域</div>
            <div>公開状況</div>
          </div>

          {rows.length === 0 && (
            <div className="px-4.5 py-10 text-center text-sm text-hs-text-secondary">
              承認ずみの記事はまだありません。
            </div>
          )}

          {rows.map(({ article, doc }) => {
            return (
              <Link
                key={article.id}
                href={`/articles/${article.id}`}
                className="grid grid-cols-[1fr_3fr_1fr_1fr] items-center border-t border-hs-stone-100 px-4.5 py-3.5 hover:bg-hs-stone-50"
              >
                <div className="text-[13px] text-hs-text-secondary">
                  {article.updatedAt.slice(0, 10)}
                </div>
                <div className="min-w-0 pr-4">
                  <div className="truncate text-[13px] font-bold text-hs-text">
                    {article.titleRewritten}
                  </div>
                  <div className="truncate text-[11px] text-hs-stone-400">{doc?.originalFilename}</div>
                </div>
                <div>
                  <span className={"rounded-full border px-2.5 py-0.5 text-[12px] " + REGION_BADGE_CLASS[article.regionTag]}>
                    {REGION_LABEL[article.regionTag]}
                  </span>
                </div>
                <div className="text-[13px] text-hs-text-secondary">
                  {article.status === "exported" ? "書き出しずみ" : "承認ずみ（まだ書き出していません）"}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
