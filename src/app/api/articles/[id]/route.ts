import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getArticleById, updateArticle } from "@/lib/data/store";
import type { Article, RegionTag } from "@/lib/types/domain";

const VALID_REGION_TAGS: RegionTag[] = [
  "kitatama_tobu",
  "nishitokyo",
  "kodaira",
  "multiple",
  "undetermined",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ article });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Article> = {};

  if (typeof body.regionTag === "string" && VALID_REGION_TAGS.includes(body.regionTag)) {
    patch.regionTag = body.regionTag;
  }
  if (typeof body.bodyRewritten === "string") {
    patch.bodyRewritten = body.bodyRewritten;
  }
  if (typeof body.titleRewritten === "string") {
    patch.titleRewritten = body.titleRewritten;
  }

  const updated = await updateArticle(id, patch);
  return NextResponse.json({ article: updated });
}
