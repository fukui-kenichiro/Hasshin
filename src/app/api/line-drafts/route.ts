import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createLineDraft, getArticleById } from "@/lib/data/store";
import { generateLineMessage } from "@/lib/line/generate";

export const maxDuration = 60;

// 下書き（ベタ打ち）または承認済み記事から、LINE配信用の短文を作って保存する。
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";

  let sourceType: "manual" | "article";
  let sourceArticleId: string | null = null;
  let sourceText: string;

  if (typeof body.articleId === "string" && body.articleId) {
    const article = await getArticleById(body.articleId);
    if (!article) return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    if ((article.status !== "approved" && article.status !== "exported") || !article.bodyRewritten) {
      return NextResponse.json({ error: "承認ずみで書き直しのある記事のみ選べます" }, { status: 409 });
    }
    sourceType = "article";
    sourceArticleId = article.id;
    sourceText = `${article.titleRewritten ?? article.titleOriginal}\n\n${article.bodyRewritten}`;
    if (note) sourceText += `\n\nURL・補足:\n${note}`;
  } else {
    const text = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
    if (!text) return NextResponse.json({ error: "周知したい内容を入力してください" }, { status: 400 });
    sourceType = "manual";
    sourceText = text;
  }

  try {
    const { messageText, notes } = await generateLineMessage({ sourceText });
    const draft = await createLineDraft({
      sourceType,
      sourceArticleId,
      sourceText,
      messageText,
      aiNotes: notes,
      createdBy: user.id,
    });
    return NextResponse.json({ id: draft.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "文案の作成に失敗しました", details: message }, { status: 500 });
  }
}
