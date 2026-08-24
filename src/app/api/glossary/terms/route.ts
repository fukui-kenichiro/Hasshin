import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { addGlossaryTerm, listGlossaryTerms } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ terms: await listGlossaryTerms() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const categoryId = body?.categoryId as string | undefined;
  const term = (body?.term as string | undefined)?.trim();
  const explanation = (body?.explanation as string | undefined)?.trim();

  if (!categoryId || !term || !explanation) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const entry = await addGlossaryTerm(categoryId, term, explanation);
  if (!entry) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }
  return NextResponse.json({ term: entry });
}
