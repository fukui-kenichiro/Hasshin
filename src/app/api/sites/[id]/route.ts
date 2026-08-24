import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { updateSite } from "@/lib/data/store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Partial<{ baseUrl: string | null; wpApiKey: string | null }> = {};
  if (typeof body.baseUrl === "string") patch.baseUrl = body.baseUrl.trim() || null;
  if (typeof body.wpApiKey === "string" && body.wpApiKey.trim()) patch.wpApiKey = body.wpApiKey.trim();

  const updated = await updateSite(id, patch);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
