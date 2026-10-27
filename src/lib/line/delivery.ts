import { claimDueLineDrafts, updateLineDraft } from "@/lib/data/store";
import { LineApiError, broadcastText, getLineToken } from "@/lib/line/client";

const MAX_ATTEMPTS = 3;

// 配信時刻を迎えた予約を一斉配信する。毎分の定期実行（/api/cron/line-send）から呼ばれる。
export async function deliverDueLineDrafts(): Promise<{ sent: number; failed: number; retrying: number }> {
  const result = { sent: 0, failed: 0, retrying: 0 };
  const drafts = await claimDueLineDrafts();
  if (drafts.length === 0) return result;

  const token = await getLineToken();

  for (const draft of drafts) {
    if (!token) {
      await updateLineDraft(draft.id, {
        status: "failed",
        deliveryError: "LINEのチャネルアクセストークンが登録されていません。設定画面で登録してください。",
      });
      result.failed++;
      continue;
    }
    try {
      await broadcastText(token, draft.messageText, draft.retryKey);
      await updateLineDraft(draft.id, { status: "sent", sentAt: new Date().toISOString(), deliveryError: null });
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = err instanceof LineApiError && err.retryable;
      if (retryable && draft.deliveryAttempts < MAX_ATTEMPTS) {
        // 配信時刻は変えず、次の定期実行でもう一度試す（再試行キーがあるので二重配信にはならない）
        await updateLineDraft(draft.id, { status: "scheduled", deliveryError: message });
        result.retrying++;
      } else {
        await updateLineDraft(draft.id, { status: "failed", deliveryError: message });
        result.failed++;
      }
    }
  }
  return result;
}
