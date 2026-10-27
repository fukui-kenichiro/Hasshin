"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LineDraft } from "@/lib/types/domain";
import { LINE_STATUS_BADGE_CLASS, LINE_STATUS_LABEL } from "@/lib/ui/badges";
import { findMissingUrls } from "@/lib/line/urls";
import { FriendlyError } from "@/components/ui/FriendlyError";

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LineDraftEditor({
  draft: initialDraft,
  lineReady,
  hasTestUser,
}: {
  draft: LineDraft;
  lineReady: boolean;
  hasTestUser: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [messageText, setMessageText] = useState(initialDraft.messageText);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<null | "save" | "approve" | "regenerate" | "schedule" | "cancel" | "test" | "delete">(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  const dirty = messageText !== draft.messageText;
  const missingUrls = findMissingUrls(draft.sourceText, messageText);
  const locked = draft.status === "scheduled" || draft.status === "sending" || draft.status === "sent";
  const canSchedule = draft.status === "approved" || draft.status === "failed";

  async function call(kind: NonNullable<typeof busy>, url: string, method: string, body?: unknown) {
    setError(null);
    setBusy(kind);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "処理に失敗しました", details: data.details });
        return null;
      }
      return data;
    } catch {
      setError({ message: "通信に失敗しました。もう一度お試しください。" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  function applyDraft(next: LineDraft) {
    setDraft(next);
    setMessageText(next.messageText);
  }

  async function handleSave() {
    const data = await call("save", `/api/line-drafts/${draft.id}`, "PATCH", { messageText });
    if (data) applyDraft(data.draft);
  }
  async function handleAction(action: "approve" | "unapprove" | "cancel_schedule") {
    const data = await call(
      action === "cancel_schedule" ? "cancel" : "approve",
      `/api/line-drafts/${draft.id}`,
      "PATCH",
      { action }
    );
    if (data) applyDraft(data.draft);
  }
  async function handleSchedule() {
    const data = await call("schedule", `/api/line-drafts/${draft.id}`, "PATCH", {
      action: "schedule",
      scheduledAt: new Date(scheduleInput).toISOString(),
    });
    if (data) {
      applyDraft(data.draft);
      setConfirmingSchedule(false);
      setScheduleInput("");
    }
  }
  async function handleTestSend() {
    setTestResult(null);
    const data = await call("test", `/api/line-drafts/${draft.id}/test-send`, "POST");
    if (data) setTestResult("テスト送信しました。登録したLINEアカウントのトークを確認してください。");
  }
  async function handleRegenerate() {
    const data = await call("regenerate", `/api/line-drafts/${draft.id}/regenerate`, "POST", { instruction });
    if (data) {
      applyDraft(data.draft);
      setInstruction("");
    }
  }
  async function handleDelete() {
    const data = await call("delete", `/api/line-drafts/${draft.id}`, "DELETE");
    if (data) {
      router.push("/line");
      router.refresh();
    }
  }
  async function handleCopy() {
    await navigator.clipboard.writeText(draft.messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-4">
        <Link href="/line" className="text-[12px] text-hs-text-secondary hover:text-hs-link">
          ← 文案の一覧に戻る
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[19px] font-bold text-hs-text">LINE配信文案</span>
          <span className={"rounded-full border px-2.5 py-0.5 text-[12px] " + LINE_STATUS_BADGE_CLASS[draft.status]}>
            {LINE_STATUS_LABEL[draft.status]}
          </span>
          <span className="text-[12px] text-hs-stone-400">{draft.createdAt.slice(0, 10)} 作成</span>
        </div>
      </div>

      <div className="flex flex-1 gap-5 overflow-hidden px-8 py-5">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
          <div className="bg-hs-stone-100 px-4 py-2.5 text-[12px] font-bold text-hs-stone-600">
            もとの内容（{draft.sourceType === "article" ? "承認ずみの記事" : "入力した下書き"}）
          </div>
          <div className="flex-1 overflow-auto whitespace-pre-wrap p-4 text-sm leading-8 text-hs-text">{draft.sourceText}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto">
          <div className="flex flex-col overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
            <div className="flex items-center justify-between bg-hs-stone-100 px-4 py-2.5">
              <span className="text-[12px] font-bold text-hs-stone-600">LINEで配信する文案（直接書き換えられます）</span>
              <span className="text-[12px] text-hs-stone-400">{messageText.length}字</span>
            </div>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={locked}
              rows={Math.max(10, messageText.split("\n").length + 2)}
              className="resize-y p-4 text-sm leading-8 text-hs-text outline-none disabled:bg-hs-stone-50"
            />
          </div>

          {missingUrls.length > 0 && (
            <div className="rounded-md border border-hs-danger-border bg-hs-danger-bg px-3.5 py-2.5 text-[12px] leading-relaxed text-hs-danger-text">
              <span className="font-bold">もとの内容にあるURLが文案に入っていません。</span>
              配信前に確認してください。
              {missingUrls.map((u) => (
                <div key={u} className="break-all">
                  {u}
                </div>
              ))}
            </div>
          )}

          {draft.aiNotes.length > 0 && (
            <div className="rounded-md border border-hs-warn-border bg-hs-warn-bg px-3.5 py-2.5 text-[12px] leading-relaxed text-hs-warn-text">
              <div className="font-bold">AIからの確認事項</div>
              <ul className="ml-4 list-disc">
                {draft.aiNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {error && <FriendlyError message={error.message} details={error.details} />}

          {!locked && (
            <div className="flex flex-wrap gap-2">
              {dirty ? (
                <button
                  onClick={handleSave}
                  disabled={busy !== null || !messageText.trim()}
                  className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
                >
                  {busy === "save" ? "保存中…" : "修正を保存する"}
                </button>
              ) : draft.status === "draft" ? (
                <button
                  onClick={() => handleAction("approve")}
                  disabled={busy !== null}
                  className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
                >
                  {busy === "approve" ? "承認中…" : "この文案を承認する"}
                </button>
              ) : (
                <button
                  onClick={() => handleAction("unapprove")}
                  disabled={busy !== null}
                  className="rounded-md border border-hs-stone-300 px-4 py-2 text-[13px] text-hs-text-secondary hover:bg-hs-stone-50 disabled:opacity-50"
                >
                  承認を取り消す
                </button>
              )}
              {dirty && (
                <button
                  onClick={() => setMessageText(draft.messageText)}
                  disabled={busy !== null}
                  className="rounded-md border border-hs-stone-300 px-4 py-2 text-[13px] text-hs-text-secondary hover:bg-hs-stone-50"
                >
                  修正を取り消す
                </button>
              )}
            </div>
          )}

          {draft.status === "failed" && draft.deliveryError && (
            <FriendlyError message="配信に失敗しました。内容を確認して、もう一度予約してください。" details={draft.deliveryError} />
          )}

          {canSchedule && !dirty && (
            <div className="rounded-lg border border-hs-success-border bg-hs-success-bg p-4">
              <div className="mb-1.5 text-[13px] font-bold text-hs-success-text">配信を予約する（友だち全員に配信されます）</div>
              {!lineReady ? (
                <div className="text-[12px] leading-relaxed text-hs-danger-text">
                  LINE公式アカウントとの連携が未設定です。
                  <Link href="/settings" className="underline">
                    設定画面
                  </Link>
                  でチャネルアクセストークンを登録してください。
                </div>
              ) : !confirmingSchedule ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] text-hs-text-secondary">配信日時（日本時間）</label>
                    <input
                      type="datetime-local"
                      value={scheduleInput}
                      onChange={(e) => setScheduleInput(e.target.value)}
                      className="rounded border border-hs-stone-300 bg-white px-2.5 py-1.5 text-sm text-hs-text outline-none focus:border-hs-primary"
                    />
                  </div>
                  <button
                    onClick={() => setConfirmingSchedule(true)}
                    disabled={!scheduleInput || busy !== null}
                    className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
                  >
                    予約の内容を確認する
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-hs-success-border bg-white p-3">
                  <div className="text-[13px] font-bold text-hs-text">
                    {formatJst(new Date(scheduleInput).toISOString())} に、上の文案をLINE公式アカウントの友だち全員へ配信します。
                  </div>
                  <div className="text-[12px] text-hs-text-secondary">
                    配信が始まった後は取り消せません。配信前であれば、いつでも予約を取り消せます。
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSchedule}
                      disabled={busy !== null}
                      className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
                    >
                      {busy === "schedule" ? "予約中…" : "この内容で予約する"}
                    </button>
                    <button
                      onClick={() => setConfirmingSchedule(false)}
                      disabled={busy !== null}
                      className="rounded-md border border-hs-stone-300 px-4 py-2 text-[13px] text-hs-text-secondary hover:bg-hs-stone-50"
                    >
                      戻る
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {draft.status === "scheduled" && draft.scheduledAt && (
            <div className="rounded-lg border border-hs-kitatama-border bg-hs-kitatama-bg p-4">
              <div className="mb-1 text-[13px] font-bold text-hs-kitatama-text">
                {formatJst(draft.scheduledAt)} に配信予約ずみです
              </div>
              <div className="mb-3 text-[12px] leading-relaxed text-hs-text-secondary">
                配信は毎分チェックされ、時刻を過ぎると自動で友だち全員に送られます（数分ずれることがあります）。文面を直したいときは、予約を取り消してください。
              </div>
              {draft.deliveryError && (
                <div className="mb-2 text-[12px] text-hs-warn-text">前回の送信で一時的なエラーがありました。自動でやり直します：{draft.deliveryError}</div>
              )}
              <button
                onClick={() => handleAction("cancel_schedule")}
                disabled={busy !== null}
                className="rounded-md border border-hs-stone-300 bg-white px-4 py-2 text-[13px] text-hs-text-secondary hover:bg-hs-stone-50 disabled:opacity-50"
              >
                {busy === "cancel" ? "取り消し中…" : "予約を取り消す"}
              </button>
            </div>
          )}

          {draft.status === "sending" && (
            <div className="rounded-md border border-hs-warn-border bg-hs-warn-bg px-3.5 py-2.5 text-[12px] text-hs-warn-text">
              配信中です。少し待ってから、この画面を開き直してください。
            </div>
          )}

          {draft.status === "sent" && (
            <div className="rounded-md border border-hs-stone-300 bg-hs-stone-50 px-3.5 py-2.5 text-[12px] text-hs-text-secondary">
              {draft.sentAt ? formatJst(draft.sentAt) : ""} に友だち全員へ配信しました。
            </div>
          )}

          {draft.status !== "sent" && draft.status !== "sending" && (
            <div className="rounded-lg border border-hs-stone-300 bg-white p-4">
              <div className="mb-1 text-[13px] font-bold text-hs-text">テスト送信</div>
              <div className="mb-2 text-[12px] leading-relaxed text-hs-text-secondary">
                設定画面で登録したテスト用のLINEアカウント1件にだけ送ります（友だち全員には届きません）。保存ずみの文案が送られます。
              </div>
              {testResult && <div className="mb-2 text-[12px] text-hs-success-text">{testResult}</div>}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleTestSend}
                  disabled={busy !== null || dirty || !lineReady || !hasTestUser}
                  className="rounded-md border border-hs-primary px-3.5 py-1.5 text-[12px] font-bold text-hs-primary hover:bg-hs-stone-50 disabled:opacity-50"
                >
                  {busy === "test" ? "送信中…" : "自分にテスト送信する"}
                </button>
                <button
                  onClick={handleCopy}
                  className="rounded-md border border-hs-stone-300 px-3.5 py-1.5 text-[12px] text-hs-text-secondary hover:bg-hs-stone-50"
                >
                  {copied ? "コピーしました" : "文案をコピー"}
                </button>
              </div>
              {(!lineReady || !hasTestUser) && (
                <div className="mt-2 text-[11px] text-hs-stone-400">
                  テスト送信には、設定画面でのトークンとテスト送信先ユーザーIDの登録が必要です。
                </div>
              )}
              {dirty && <div className="mt-2 text-[11px] text-hs-stone-400">修正を保存すると、テスト送信できます。</div>}
            </div>
          )}

          {!locked && (
            <div className="rounded-lg border border-hs-stone-300 bg-white p-4">
              <div className="mb-1.5 text-[13px] font-bold text-hs-text">AIに作り直してもらう</div>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例）もっと短く／日時を冒頭に／やわらかい言い回しに（空欄のまま実行すると、ゼロから作り直します）"
                className="min-h-[64px] w-full rounded border border-hs-stone-300 p-2.5 text-sm leading-7 text-hs-text outline-none focus:border-hs-primary"
              />
              <div className="mt-1.5 text-[11px] text-hs-stone-400">作り直すと、承認はいったん取り消されます。</div>
              <button
                onClick={handleRegenerate}
                disabled={busy !== null}
                className="mt-2 rounded-md border border-hs-primary px-3.5 py-1.5 text-[12px] font-bold text-hs-primary hover:bg-hs-stone-50 disabled:opacity-50"
              >
                {busy === "regenerate" ? "作り直しています…" : "作り直す"}
              </button>
            </div>
          )}

          {draft.status !== "scheduled" && draft.status !== "sending" && (
          <div className="rounded-lg border border-hs-danger-border bg-white p-4">
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded border border-hs-danger px-3 py-1.5 text-[11px] font-bold text-hs-danger hover:bg-hs-danger-bg"
              >
                この文案を削除する
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-hs-danger-text">削除すると元に戻せません。</span>
                <button
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="rounded bg-hs-danger px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {busy === "delete" ? "削除中…" : "削除する"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded border border-hs-stone-300 px-3 py-1.5 text-[11px] text-hs-text-secondary"
                >
                  やめる
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
