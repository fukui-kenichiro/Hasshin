import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteLineDraft, getLineDraftById, updateLineDraft } from "@/lib/data/store";
import { getLineToken } from "@/lib/line/client";

type Action = "approve" | "unapprove" | "schedule" | "cancel_schedule";

const LINE_TEXT_LIMIT = 5000;
const MIN_LEAD_MS = 60 * 1000;
const MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000;

// 文案の手動修正と、承認・承認取り消し・配信予約・予約取り消し。
// 承認後に文面を変えた場合は、承認した文面と配信する文面がずれないよう承認を取り消す。
// 配信予約中・配信中・配信ずみの文案は、文面を変えられない（予約を取り消してから直す）。
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await getLineDraftById(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action as Action | undefined;
  const editable = draft.status === "draft" || draft.status === "approved" || draft.status === "failed";

  if (typeof body.messageText === "string") {
    const text = body.messageText.trim();
    if (!text) return NextResponse.json({ error: "文案が空です" }, { status: 400 });
    if (text !== draft.messageText) {
      if (!editable) {
        return NextResponse.json({ error: "配信予約中・配信ずみの文案は修正できません。予約を取り消してから直してください" }, { status: 409 });
      }
      const updated = await updateLineDraft(id, {
        messageText: text,
        status: "draft",
        approvedBy: null,
        approvedAt: null,
        scheduledAt: null,
        deliveryError: null,
      });
      return NextResponse.json({ draft: updated });
    }
  }

  if (action === "approve") {
    if (!editable) return NextResponse.json({ error: "この状態では承認できません" }, { status: 409 });
    const updated = await updateLineDraft(id, {
      status: "approved",
      approvedBy: user.id,
      approvedAt: new Date().toISOString(),
      deliveryError: null,
    });
    return NextResponse.json({ draft: updated });
  }

  if (action === "unapprove") {
    if (draft.status !== "approved" && draft.status !== "failed") {
      return NextResponse.json({ error: "この状態では承認を取り消せません" }, { status: 409 });
    }
    const updated = await updateLineDraft(id, {
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      scheduledAt: null,
      deliveryError: null,
    });
    return NextResponse.json({ draft: updated });
  }

  if (action === "schedule") {
    if (draft.status !== "approved" && draft.status !== "failed") {
      return NextResponse.json({ error: "承認ずみの文案だけ配信を予約できます" }, { status: 409 });
    }
    if (draft.messageText.length > LINE_TEXT_LIMIT) {
      return NextResponse.json({ error: `文案が長すぎます（LINEの上限は${LINE_TEXT_LIMIT}字）` }, { status: 400 });
    }
    const scheduledAt = new Date(body.scheduledAt);
    const lead = scheduledAt.getTime() - Date.now();
    if (Number.isNaN(scheduledAt.getTime()) || lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) {
      return NextResponse.json({ error: "配信日時は、いまから1分後〜1年以内で指定してください" }, { status: 400 });
    }
    if (!(await getLineToken())) {
      return NextResponse.json({ error: "LINEのチャネルアクセストークンが未登録です。設定画面で登録してください" }, { status: 409 });
    }
    const updated = await updateLineDraft(id, {
      status: "scheduled",
      scheduledAt: scheduledAt.toISOString(),
      deliveryError: null,
      deliveryAttempts: 0,
      retryKey: randomUUID(),
    });
    return NextResponse.json({ draft: updated });
  }

  if (action === "cancel_schedule") {
    if (draft.status !== "scheduled") {
      return NextResponse.json({ error: "取り消せる予約がありません（すでに配信中・配信ずみの可能性があります）" }, { status: 409 });
    }
    const updated = await updateLineDraft(id, { status: "approved", scheduledAt: null });
    return NextResponse.json({ draft: updated });
  }

  return NextResponse.json({ draft });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await getLineDraftById(id);
  if (draft && (draft.status === "scheduled" || draft.status === "sending")) {
    return NextResponse.json({ error: "配信予約中の文案は削除できません。先に予約を取り消してください" }, { status: 409 });
  }
  await deleteLineDraft(id);
  return NextResponse.json({ ok: true });
}
