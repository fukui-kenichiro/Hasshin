// LINE公式アカウント（Messaging API）の呼び出し。
// チャネルアクセストークンは設定画面から登録され、app_settings に保存される。

import { getSetting } from "@/lib/data/store";

export const LINE_TOKEN_KEY = "line_channel_access_token";
export const LINE_TEST_USER_KEY = "line_test_user_id";

const BASE_URL = process.env.LINE_API_BASE_URL ?? "https://api.line.me";

export class LineApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    // 通信エラー（LINEに届いたか不明）や5xxは、時間をおいて再試行してよい
    public retryable: boolean
  ) {
    super(describeLineError(status, body));
  }
}

function describeLineError(status: number, body: string): string {
  if (status === 0) return "LINEのサーバーに接続できませんでした。";
  if (status === 401) return "LINEのチャネルアクセストークンが正しくないか、期限切れです。設定画面で登録し直してください。";
  if (status === 403) return "LINEのチャネルアクセストークンに、この操作の権限がありません。";
  if (status === 429) return "LINEの月間の配信上限に達しているか、短時間に送りすぎています。";
  if (status >= 500) return `LINE側で一時的なエラーが発生しました（HTTP ${status}）。`;
  return `LINEがメッセージを受け付けませんでした（HTTP ${status}）。${body.slice(0, 200)}`;
}

export async function getLineToken(): Promise<string | null> {
  return getSetting(LINE_TOKEN_KEY);
}

async function lineRequest(token: string, method: "GET" | "POST", path: string, body?: unknown, retryKey?: string) {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new LineApiError(0, "", true);
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new LineApiError(res.status, text, res.status >= 500);
  return text ? JSON.parse(text) : {};
}

// 友だち全員への一斉配信。再試行キーを付けるので、同じキーでの再送は二重配信にならない
// （すでに受け付け済みなら409が返るため、成功として扱う）。
export async function broadcastText(token: string, text: string, retryKey: string): Promise<void> {
  try {
    await lineRequest(token, "POST", "/v2/bot/message/broadcast", { messages: [{ type: "text", text }] }, retryKey);
  } catch (err) {
    if (err instanceof LineApiError && err.status === 409) return;
    throw err;
  }
}

export async function pushText(token: string, to: string, text: string): Promise<void> {
  await lineRequest(token, "POST", "/v2/bot/message/push", { to, messages: [{ type: "text", text }] });
}

export async function getBotInfo(token: string): Promise<{ displayName: string; basicId?: string }> {
  return lineRequest(token, "GET", "/v2/bot/info");
}

export async function getQuota(token: string): Promise<{ limit: number | null; used: number }> {
  const [quota, consumption] = await Promise.all([
    lineRequest(token, "GET", "/v2/bot/message/quota"),
    lineRequest(token, "GET", "/v2/bot/message/quota/consumption"),
  ]);
  return { limit: quota.type === "limited" ? quota.value : null, used: consumption.totalUsage ?? 0 };
}
