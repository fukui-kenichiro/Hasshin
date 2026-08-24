import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enqueueJob, getArticleById, updateArticle } from "@/lib/data/store";

// 送信に失敗した記事や、サイト接続設定を後から直した記事を
// 手動で再送信するためのエンドポイント。
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (article.status !== "approved" && article.status !== "exported") {
    return NextResponse.json({ error: "not_approved" }, { status: 409 });
  }

  await updateArticle(id, { wpPublishStatus: "pending", wpPublishError: null });
  await enqueueJob({ jobType: "publish_to_wp", relatedArticleId: id });

  return NextResponse.json({ ok: true });
}
