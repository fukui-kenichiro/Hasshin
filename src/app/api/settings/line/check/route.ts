import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { LineApiError, getBotInfo, getLineToken, getQuota } from "@/lib/line/client";

// 保存したトークンでLINEに接続できるかを確認し、アカウント名と今月の配信通数を返す。
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = await getLineToken();
  if (!token) return NextResponse.json({ error: "トークンが未登録です" }, { status: 409 });

  try {
    const [info, quota] = await Promise.all([getBotInfo(token), getQuota(token)]);
    return NextResponse.json({ displayName: info.displayName, quotaLimit: quota.limit, quotaUsed: quota.used });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof LineApiError ? err.body : undefined;
    return NextResponse.json({ error: message, details }, { status: 502 });
  }
}
