import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enqueueJob, getArticleById } from "@/lib/data/store";
import type { SiteSlug } from "@/lib/types/domain";

const SITE_LABEL: Record<SiteSlug, string> = {
  "kitatama-tobu": "北多摩東部地区委員会HP",
  nishitokyo: "西東京HP",
  kodaira: "小平HP",
};

// 条件（プロンプト）を指定してリライトを実行させるエンドポイント。
// - まだリライトされていない記事（「党内限定」等の判定で自動リライトを
//   見送られたもの）では、条件付きで新たにリライトする
// - すでにリライトされている記事では、現在の文章に対する修正指示として使う
//   （ジョブ側で bodyRewritten の有無を見て、どちらの起点で書くかを判断する）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const condition = typeof body.condition === "string" ? body.condition.trim() : "";
  if (!condition) {
    return NextResponse.json({ error: "condition_required" }, { status: 400 });
  }

  const targetSiteLabel = article.targetSiteSlug ? SITE_LABEL[article.targetSiteSlug] : "北多摩東部地区委員会HP";

  await enqueueJob({
    jobType: "rewrite",
    relatedArticleId: id,
    relatedSourceDocumentId: article.sourceDocumentId,
    payload: { targetSiteLabel, isDerivative: false, rewriteCondition: condition },
  });

  return NextResponse.json({ ok: true });
}
