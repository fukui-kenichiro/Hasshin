import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { addGlossaryCategory, listGlossaryCategories } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ categories: await listGlossaryCategories() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const category = await addGlossaryCategory(name);
  return NextResponse.json({ category });
}
