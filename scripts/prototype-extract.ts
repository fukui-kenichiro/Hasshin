// マイルストーン2: PDF → AI構造化抽出のプロトタイプ。
//
// 使い方:
//   ANTHROPIC_API_KEY=xxxx npx tsx scripts/prototype-extract.ts <PDFファイルパス>
//
// 実行すると、PDFの各ページをpoppler(pdftoppm)でPNG化し、Claude Vision APIで
// extract_page → assemble_articles の2段階の構造化抽出を行い、
// prototype/pdf-extraction/output/ 以下にJSONを書き出す。
//
// 本番実装（Next.js API Routes + processing_jobs キュー）に移す際は、
// rasterizePdfToPngPages / 抽出ロジックをそのまま job ハンドラに移植する想定
// （実際に src/lib/pipeline/jobs.ts に移植済み。このスクリプトはマイルストーン
// 2時点の検証記録として残している。ラスタライズは pdfjs-dist ベースに更新済み）。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getClaudeClient, EXTRACTION_MODEL } from "../src/lib/ai/claude";
import { rasterizePdfToPngPages } from "../src/lib/pdf/rasterize";
import {
  EXTRACT_PAGE_SYSTEM_PROMPT,
  buildExtractPageUserPrompt,
  type ExtractedPage,
} from "../src/lib/ai/prompts/extract-page";
import {
  ASSEMBLE_ARTICLES_SYSTEM_PROMPT,
  buildAssembleArticlesUserPrompt,
  type AssembledArticle,
} from "../src/lib/ai/prompts/assemble-articles";

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw);
}

async function extractPage(
  pngBuffer: Buffer,
  pageNumber: number
): Promise<ExtractedPage> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system: EXTRACT_PAGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: pngBuffer.toString("base64"),
            },
          },
          { type: "text", text: buildExtractPageUserPrompt(pageNumber) },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`ページ${pageNumber}: テキスト応答が得られませんでした`);
  }
  return parseJsonFromResponse(textBlock.text) as ExtractedPage;
}

async function assembleArticles(
  pages: ExtractedPage[]
): Promise<AssembledArticle[]> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system: ASSEMBLE_ARTICLES_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildAssembleArticlesUserPrompt(pages) },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("記事構造化: テキスト応答が得られませんでした");
  }
  const parsed = parseJsonFromResponse(textBlock.text) as {
    articles: AssembledArticle[];
  };
  return parsed.articles;
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error(
      "使い方: npx tsx scripts/prototype-extract.ts <PDFファイルパス>"
    );
    process.exit(1);
  }

  const outDir = path.resolve(
    __dirname,
    "../prototype/pdf-extraction/output"
  );
  mkdirSync(outDir, { recursive: true });
  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  console.log(`[1/3] PDFをページ画像に変換中... (${pdfPath})`);
  const pdfBuffer = readFileSync(pdfPath);
  const pages = await rasterizePdfToPngPages(pdfBuffer);
  console.log(`  → ${pages.length}ページを検出`);

  console.log("[2/3] 各ページをClaude Vision APIで構造化抽出中...");
  const extractedPages: ExtractedPage[] = [];
  for (const page of pages) {
    console.log(`  - ページ${page.pageNumber}を抽出中...`);
    const extracted = await extractPage(page.pngBuffer, page.pageNumber);
    extractedPages.push(extracted);
  }
  extractedPages.sort((a, b) => a.page_number - b.page_number);

  const pagesOutPath = path.join(outDir, `${baseName}.pages.json`);
  writeFileSync(pagesOutPath, JSON.stringify(extractedPages, null, 2), "utf-8");
  console.log(`  → ページ単位の抽出結果を書き出しました: ${pagesOutPath}`);

  console.log("[3/3] 記事（トピック）単位に構造化中...");
  const articles = await assembleArticles(extractedPages);
  const articlesOutPath = path.join(outDir, `${baseName}.articles.json`);
  writeFileSync(
    articlesOutPath,
    JSON.stringify(articles, null, 2),
    "utf-8"
  );
  console.log(`  → 記事単位の結果を書き出しました: ${articlesOutPath}`);

  console.log("\n=== サマリー ===");
  for (const a of articles) {
    console.log(
      `- [${a.public_suitability}] ${a.title} (p.${a.source_pages.join(",")})`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
