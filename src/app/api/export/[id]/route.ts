import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getArticleById, hasUnresolvedInternalInfo, updateArticle } from "@/lib/data/store";
import type { ExportFormat } from "@/lib/types/domain";

// ブラウザでもWindowsのメモ帳等でも文字化けしないようにする:
// - HTMLは <meta charset="UTF-8"> を明記した完全な文書にする（この指定が
//   ないとブラウザが文字コードを誤検出し、文字化けすることがあった）
// - プレーンテキスト・Markdownの先頭にUTF-8のBOMを付ける（BOMが無いと
//   Windowsの一部アプリがShift-JIS等と誤認識し、文字化けすることがある）
const UTF8_BOM = "﻿";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHtml(title: string, body: string): string {
  const paragraphs = body
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
</head>
<body>
<article>
<h1>${escapeHtml(title)}</h1>
${paragraphs}
</article>
</body>
</html>
`;
}

function toMarkdown(title: string, body: string): string {
  return `# ${title}\n\n${body}`;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "article";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!article.titleRewritten || !article.bodyRewritten) {
    return NextResponse.json({ error: "not_rewritten" }, { status: 409 });
  }

  if (article.status !== "approved" && article.status !== "exported") {
    return NextResponse.json({ error: "not_approved" }, { status: 409 });
  }

  // 安全側に倒す: 未確認の内部情報が1件でも残っていれば書き出しをブロックする
  if (await hasUnresolvedInternalInfo(id)) {
    return NextResponse.json(
      { error: "unresolved_internal_info", message: "未確認の内部情報が残っているため、書き出しできません。先に内部情報の確認を済ませてください。" },
      { status: 409 }
    );
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "html") as ExportFormat;

  let content: string;
  let contentType: string;
  let extension: string;
  if (format === "markdown") {
    content = UTF8_BOM + toMarkdown(article.titleRewritten, article.bodyRewritten);
    contentType = "text/markdown; charset=utf-8";
    extension = "md";
  } else if (format === "plain_text") {
    content = UTF8_BOM + `${article.titleRewritten}\n\n${article.bodyRewritten}`;
    contentType = "text/plain; charset=utf-8";
    extension = "txt";
  } else {
    content = toHtml(article.titleRewritten, article.bodyRewritten);
    contentType = "text/html; charset=utf-8";
    extension = "html";
  }

  await updateArticle(id, { status: "exported" });

  const filename = `${sanitizeFilename(article.titleRewritten)}.${extension}`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      // 日本語ファイル名を正しく扱うため RFC 6266 の filename* 形式を使う
      "Content-Disposition": `inline; filename="download.${extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
