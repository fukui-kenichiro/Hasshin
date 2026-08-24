import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enqueueJob, getArticleById, updateArticle } from "@/lib/data/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date().toISOString();
  const updated = await updateArticle(id, {
    status: "approved",
    approvedBy: user.id,
    approvedAt: now,
    reviewedBy: user.id,
    reviewedAt: now,
  });

  // 承認と同時に、掲載先サイトのWordPressへ下書きとして自動送信するジョブを積む。
  await enqueueJob({ jobType: "publish_to_wp", relatedArticleId: id });

  return NextResponse.json({ article: updated });
}
