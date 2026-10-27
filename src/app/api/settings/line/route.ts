import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setSetting } from "@/lib/data/store";
import { LINE_TEST_USER_KEY, LINE_TOKEN_KEY } from "@/lib/line/client";

// LINE公式アカウントの連携設定。トークンは保存するだけで、ブラウザへは返さない。
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  if (typeof body.channelAccessToken === "string" && body.channelAccessToken.trim()) {
    await setSetting(LINE_TOKEN_KEY, body.channelAccessToken.trim());
  }
  if (typeof body.testUserId === "string") {
    await setSetting(LINE_TEST_USER_KEY, body.testUserId.trim() || null);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await setSetting(LINE_TOKEN_KEY, null);
  return NextResponse.json({ ok: true });
}
