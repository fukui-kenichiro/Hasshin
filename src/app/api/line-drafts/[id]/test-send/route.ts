import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLineDraftById, getSetting } from "@/lib/data/store";
import { LINE_TEST_USER_KEY, LineApiError, getLineToken, pushText } from "@/lib/line/client";

// 登録したテスト用のLINEアカウント1件にだけ送る（友だち全員には届かない）。
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await getLineDraftById(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [token, testUserId] = await Promise.all([getLineToken(), getSetting(LINE_TEST_USER_KEY)]);
  if (!token) return NextResponse.json({ error: "LINEのチャネルアクセストークンが未登録です。設定画面で登録してください" }, { status: 409 });
  if (!testUserId) return NextResponse.json({ error: "テスト送信先のLINEユーザーIDが未登録です。設定画面で登録してください" }, { status: 409 });

  try {
    await pushText(token, testUserId, `【テスト配信】\n${draft.messageText}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof LineApiError ? err.body : undefined;
    return NextResponse.json({ error: message, details }, { status: 502 });
  }
}
