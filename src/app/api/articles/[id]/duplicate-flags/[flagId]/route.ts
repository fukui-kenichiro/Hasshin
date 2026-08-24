import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { updateDuplicateFlag } from "@/lib/data/store";
import type { DuplicateFlagStatus } from "@/lib/types/domain";

const VALID_STATUSES: DuplicateFlagStatus[] = ["open", "confirmed", "dismissed"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; flagId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { flagId } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body?.status as DuplicateFlagStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const updated = await updateDuplicateFlag(flagId, { status });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ flag: updated });
}
