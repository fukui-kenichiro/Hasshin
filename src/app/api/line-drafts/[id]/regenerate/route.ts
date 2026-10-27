import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLineDraftById, updateLineDraft } from "@/lib/data/store";
import { generateLineMessage } from "@/lib/line/generate";

export const maxDuration = 60;

// 指示つき（または指示なし）で文案を作り直す。指示があるときは現在の文案を下敷きに修正する。
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await getLineDraftById(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (draft.status === "scheduled" || draft.status === "sending" || draft.status === "sent") {
    return NextResponse.json({ error: "配信予約中・配信ずみの文案は作り直せません。予約を取り消してから作り直してください" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";

  try {
    const { messageText, notes } = await generateLineMessage({
      sourceText: draft.sourceText,
      instruction: instruction || undefined,
      currentMessage: instruction ? draft.messageText : undefined,
    });
    const updated = await updateLineDraft(id, {
      messageText,
      aiNotes: notes,
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      scheduledAt: null,
      deliveryError: null,
    });
    return NextResponse.json({ draft: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "文案の作り直しに失敗しました", details: message }, { status: 500 });
  }
}
