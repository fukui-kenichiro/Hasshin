import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteArticle, getArticleById, getSiteBySlug, updateArticle } from "@/lib/data/store";
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

// 記事の完全削除（重大な個人情報の混入等、事故対応のための機能）。
// 承認・却下・書き出しずみのいずれの状態からでも実行できる。
// WordPress側に既に下書きが送信済みの場合は、そちらの下書きも
// あわせて削除を試みる（失敗してもハッシン側の削除は止めない。
// その場合は warning としてWP側の手動削除が必要な旨を返す）。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let warning: string | null = null;

  if (article.wpPostId && article.targetSiteSlug) {
    const site = await getSiteBySlug(article.targetSiteSlug);
    if (site?.baseUrl && site.wpApiKey) {
      try {
        const endpoint = `${site.baseUrl.replace(/\/$/, "")}/wp-json/hasshin/v1/articles/${id}`;
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: { "X-Hasshin-Api-Key": site.wpApiKey },
        });
        if (!res.ok) {
          warning = `WordPress側の下書き削除に失敗しました（HTTP ${res.status}）。WordPress管理画面から手動で削除してください。`;
        }
      } catch {
        warning = "WordPressへの接続に失敗したため、下書きを削除できませんでした。WordPress管理画面から手動で削除してください。";
      }
    } else {
      warning = "このサイトのWordPress接続設定がないため、下書きの削除を確認できませんでした。念のためWordPress管理画面もご確認ください。";
    }
  }

  await deleteArticle(id);

  return NextResponse.json({ ok: true, warning });
}
