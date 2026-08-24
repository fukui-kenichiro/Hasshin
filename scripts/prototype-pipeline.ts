// マイルストーン3: リライト・地域タグ付け・重複検出まで含めたフルパイプラインの
// プロトタイプ。マイルストーン2の prototype-extract.ts の続き。
//
// 使い方:
//   ANTHROPIC_API_KEY=xxxx npx tsx scripts/prototype-pipeline.ts <PDFファイルパス> <suishin_news|ganbaru_news>
//
// 処理の流れ:
//   1. extract_page（ページ単位の構造化） … prototype-extract.ts と同じ
//   2. assemble_articles（記事単位への構造化、public_suitability判定）
//   3. tag_region（suishin_newsのみ。ganbaru_newsは常にkodaira固定）
//   4. rewrite（public_suitability !== 'not_suitable_internal_only' の記事のみ）
//   5. detect_duplicates（デモ用に固定の過去記事フィクスチャと比較）
//
// not_suitable_internal_only の記事は3・4をスキップし、そのままレビュー待ちに
// 回す（「公開非推奨」バッジを表示する想定）。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
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
import {
  TAG_REGION_SYSTEM_PROMPT,
  buildTagRegionUserPrompt,
  type TagRegionResult,
} from "../src/lib/ai/prompts/tag-region";
import {
  REWRITE_SYSTEM_PROMPT,
  buildRewriteUserPrompt,
  type RewriteResult,
} from "../src/lib/ai/prompts/rewrite";
import {
  DETECT_DUPLICATES_SYSTEM_PROMPT,
  buildDetectDuplicatesUserPrompt,
  type DuplicateCandidate,
  type DuplicateFlagResult,
} from "../src/lib/ai/prompts/detect-duplicates";

type SourceType = "suishin_news" | "ganbaru_news";

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw);
}

async function callClaudeJson(
  system: string,
  userContent: string | Anthropic.MessageParam["content"]
): Promise<unknown> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent as never }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("テキスト応答が得られませんでした");
  }
  return parseJsonFromResponse(textBlock.text);
}

async function extractPage(
  pngBuffer: Buffer,
  pageNumber: number
): Promise<ExtractedPage> {
  return callClaudeJson(EXTRACT_PAGE_SYSTEM_PROMPT, [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: pngBuffer.toString("base64"),
      },
    },
    { type: "text", text: buildExtractPageUserPrompt(pageNumber) },
  ]) as Promise<ExtractedPage>;
}

async function assembleArticles(
  pages: ExtractedPage[]
): Promise<AssembledArticle[]> {
  const result = (await callClaudeJson(
    ASSEMBLE_ARTICLES_SYSTEM_PROMPT,
    buildAssembleArticlesUserPrompt(pages)
  )) as { articles: AssembledArticle[] };
  return result.articles;
}

async function tagRegion(article: AssembledArticle): Promise<TagRegionResult> {
  return callClaudeJson(
    TAG_REGION_SYSTEM_PROMPT,
    buildTagRegionUserPrompt(article.title, article.body_text)
  ) as Promise<TagRegionResult>;
}

async function rewriteArticle(
  article: AssembledArticle,
  targetSiteLabel: string
): Promise<RewriteResult> {
  return callClaudeJson(
    REWRITE_SYSTEM_PROMPT,
    buildRewriteUserPrompt(article.title, article.body_text, targetSiteLabel)
  ) as Promise<RewriteResult>;
}

// デモ用の固定フィクスチャ（実際にはDBから「同じ地域タグ・直近数ヶ月」で絞り込む）。
// 実サンプルに存在しない「recycled_appeal」パターンを検証するため、
// 意図的に類似の呼びかけを含む過去記事をテストデータとして1件混ぜている。
const DUPLICATE_CANDIDATES_FIXTURE: DuplicateCandidate[] = [
  {
    id: "past-001",
    title: "西東京市議選予定候補3人の必勝を訴える演説会を開催",
    summary:
      "西東京市議選予定候補3人（大竹あつ子・中村すぐる・やまき明美）の必勝を訴える演説会を開催し、多数が参加した。",
    issueDate: "2026-06-20",
    regionTag: "nishitokyo",
  },
  {
    id: "past-002",
    title: "駅前放置自転車、対策を住民と検討",
    summary: "駅前の放置自転車問題について住民と意見交換を行った。",
    issueDate: "2026-07-17",
    regionTag: "kitatama_tobu",
  },
];

async function detectDuplicates(
  article: { title: string; bodyText: string; issueDate: string }
): Promise<DuplicateFlagResult[]> {
  const result = (await callClaudeJson(
    DETECT_DUPLICATES_SYSTEM_PROMPT,
    buildDetectDuplicatesUserPrompt(article, DUPLICATE_CANDIDATES_FIXTURE)
  )) as { flags: DuplicateFlagResult[] };
  return result.flags;
}

async function main() {
  const pdfPath = process.argv[2];
  const sourceType = (process.argv[3] as SourceType) ?? "suishin_news";
  if (!pdfPath) {
    console.error(
      "使い方: npx tsx scripts/prototype-pipeline.ts <PDFファイルパス> <suishin_news|ganbaru_news>"
    );
    process.exit(1);
  }

  const outDir = path.resolve(__dirname, "../prototype/pdf-extraction/output");
  mkdirSync(outDir, { recursive: true });
  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  console.log(`[1/4] PDFをページ画像に変換中... (${pdfPath})`);
  const pdfBuffer = readFileSync(pdfPath);
  const pages = await rasterizePdfToPngPages(pdfBuffer);
  console.log(`  → ${pages.length}ページを検出`);

  console.log("[2/4] 構造化抽出中...");
  const extractedPages: ExtractedPage[] = [];
  for (const page of pages) {
    extractedPages.push(await extractPage(page.pngBuffer, page.pageNumber));
  }
  extractedPages.sort((a, b) => a.page_number - b.page_number);
  const articles = await assembleArticles(extractedPages);
  console.log(`  → ${articles.length}件のトピックを検出`);

  console.log("[3/4] 地域タグ付け・リライト中...");
  const results = [];
  for (const article of articles) {
    let tagResult: TagRegionResult | null = null;
    if (sourceType === "suishin_news") {
      tagResult = await tagRegion(article);
    }

    let rewriteResult: RewriteResult | null = null;
    let nishitokyoRewrite: RewriteResult | null = null;
    if (article.public_suitability !== "not_suitable_internal_only") {
      rewriteResult = await rewriteArticle(article, "北多摩東部地区委員会HP");
      if (tagResult?.nishitokyo_derivative_recommended) {
        nishitokyoRewrite = await rewriteArticle(article, "西東京HP");
      }
    }

    let duplicateFlags: DuplicateFlagResult[] = [];
    if (rewriteResult) {
      duplicateFlags = await detectDuplicates({
        title: rewriteResult.title_rewritten,
        bodyText: rewriteResult.body_rewritten,
        issueDate: "2026-07-27",
      });
    }

    results.push({
      article,
      region_tag_result:
        sourceType === "ganbaru_news"
          ? { fixed: "kodaira", reason: "がんばるニュースは常に小平HP向け" }
          : tagResult,
      rewrite_kitatama_tobu: rewriteResult,
      rewrite_nishitokyo_derivative: nishitokyoRewrite,
      duplicate_flags: duplicateFlags,
    });
  }

  const outPath = path.join(outDir, `${baseName}.pipeline.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`[4/4] 完了: ${outPath}`);

  console.log("\n=== サマリー ===");
  for (const r of results) {
    console.log(
      `- [${r.article.public_suitability}] ${r.article.title} / region=${
        r.region_tag_result && "fixed" in r.region_tag_result
          ? r.region_tag_result.fixed
          : r.region_tag_result?.base_region_tag
      } / 西東京派生=${r.rewrite_nishitokyo_derivative ? "あり" : "なし"} / 重複=${
        r.duplicate_flags.length
      }件`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
