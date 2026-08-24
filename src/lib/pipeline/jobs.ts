// マイルストーン5: 非同期ジョブキューの実装。
//
// Vercelのサーバーレス関数には実行時間の上限があるため（Hobbyプランでは
// 標準10秒・設定次第で最大60秒程度）、PDF処理をページ単位・記事単位の
// 「Claude APIを1回呼ぶだけ」の粒度のジョブに分割し、processing_jobs
// テーブル（Postgres）をキューとして使う。1ジョブ=1回のAPI呼び出し程度
// なので、各ジョブの処理はどのプランのタイムアウトにも余裕で収まる。
//
// 駆動方法: アップロード画面を開いているブラウザが /api/jobs/tick を
// 連続で呼び、呼ばれるたびにキューの先頭から1件だけ処理する
// （docs/ARCHITECTURE.md の設計に対応）。Vercel Cron（1日数回）を
// セーフティネットとして併用し、放置されたジョブの処理とSupabaseの
// スリープ防止を兼ねる。

import { getClaudeClient, EXTRACTION_MODEL } from "@/lib/ai/claude";
import { rasterizePdfToPngPages } from "@/lib/pdf/rasterize";
import { downloadFile, uploadPageImage } from "@/lib/storage/files";
import {
  addDuplicateFlags,
  addInternalInfoFlags,
  claimNextJob,
  createArticle,
  createSourcePages,
  enqueueJob,
  getArticleById,
  getSourceDocumentById,
  getSourcePageById,
  listDuplicateCandidates,
  listGlossaryTerms,
  listSourcePages,
  markJobDone,
  markJobError,
  setArticleRegionTag,
  updateArticle,
  updateSourceDocument,
  updateSourcePage,
  incrementPageCountProcessed,
} from "@/lib/data/store";
import type { ProcessingJob, SiteSlug } from "@/lib/types/domain";
import {
  EXTRACT_PAGE_SYSTEM_PROMPT,
  EXTRACT_PAGE_TOOL,
  buildExtractPageUserPrompt,
  type ExtractedPage,
} from "@/lib/ai/prompts/extract-page";
import {
  ASSEMBLE_ARTICLES_SYSTEM_PROMPT,
  ASSEMBLE_ARTICLES_TOOL,
  buildAssembleArticlesUserPrompt,
  type AssembledArticle,
} from "@/lib/ai/prompts/assemble-articles";
import {
  TAG_REGION_SYSTEM_PROMPT,
  TAG_REGION_TOOL,
  buildTagRegionUserPrompt,
  type TagRegionResult,
} from "@/lib/ai/prompts/tag-region";
import {
  REWRITE_SYSTEM_PROMPT,
  REWRITE_TOOL,
  buildRewriteUserPrompt,
  type RewriteResult,
} from "@/lib/ai/prompts/rewrite";
import {
  DETECT_DUPLICATES_SYSTEM_PROMPT,
  DETECT_DUPLICATES_TOOL,
  buildDetectDuplicatesUserPrompt,
  type DuplicateFlagResult,
} from "@/lib/ai/prompts/detect-duplicates";

interface ToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; [key: string]: unknown };
}

async function callClaudeTool<T>(system: string, userContent: unknown, tool: ToolDef): Promise<T> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: userContent as any }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`「${tool.name}」の構造化出力が得られませんでした`);
  }
  return toolUse.input as T;
}

async function handleRenderPages(job: ProcessingJob): Promise<void> {
  const docId = job.relatedSourceDocumentId;
  if (!docId) throw new Error("render_pages: relatedSourceDocumentId がありません");
  const doc = await getSourceDocumentById(docId);
  if (!doc) throw new Error("対象のPDFが見つかりません");

  const pdfBuffer = await downloadFile(doc.storagePath);
  const pages = await rasterizePdfToPngPages(pdfBuffer);
  await updateSourceDocument(docId, { pageCount: pages.length });

  const sourcePages = await createSourcePages(docId, pages.length);
  for (const page of pages) {
    const row = sourcePages.find((p) => p.pageNumber === page.pageNumber);
    if (!row) continue;
    const imagePath = await uploadPageImage(docId, page.pageNumber, page.pngBuffer);
    await updateSourcePage(row.id, { imageStoragePath: imagePath });
    await enqueueJob({
      jobType: "extract_page",
      relatedSourceDocumentId: docId,
      relatedSourcePageId: row.id,
      payload: { pageNumber: page.pageNumber },
    });
  }
}

async function handleExtractPage(job: ProcessingJob): Promise<void> {
  const pageId = job.relatedSourcePageId;
  const docId = job.relatedSourceDocumentId;
  if (!pageId || !docId) throw new Error("extract_page: 関連情報がありません");
  const page = await getSourcePageById(pageId);
  if (!page || !page.imageStoragePath) throw new Error("ページ画像が見つかりません");

  const imageBuffer = await downloadFile(page.imageStoragePath);
  const result = await callClaudeTool<ExtractedPage>(
    EXTRACT_PAGE_SYSTEM_PROMPT,
    [
      { type: "image", source: { type: "base64", media_type: "image/png", data: imageBuffer.toString("base64") } },
      { type: "text", text: buildExtractPageUserPrompt(page.pageNumber) },
    ],
    EXTRACT_PAGE_TOOL
  );

  await updateSourcePage(pageId, { visionRawJson: result, status: "done" });
  await incrementPageCountProcessed(docId);

  const allPages = await listSourcePages(docId);
  const allDone = allPages.length > 0 && allPages.every((p) => p.status === "done");
  if (allDone) {
    await enqueueJob({ jobType: "assemble_articles", relatedSourceDocumentId: docId });
  }
}

async function handleAssembleArticles(job: ProcessingJob): Promise<void> {
  const docId = job.relatedSourceDocumentId;
  if (!docId) throw new Error("assemble_articles: relatedSourceDocumentId がありません");
  const doc = await getSourceDocumentById(docId);
  if (!doc) throw new Error("対象のPDFが見つかりません");

  const pages = await listSourcePages(docId);
  const extractedPages = pages
    .filter((p) => p.visionRawJson)
    .map((p) => p.visionRawJson as ExtractedPage)
    .sort((a, b) => a.page_number - b.page_number);

  const result = await callClaudeTool<{ articles: AssembledArticle[] }>(
    ASSEMBLE_ARTICLES_SYSTEM_PROMPT,
    buildAssembleArticlesUserPrompt(extractedPages),
    ASSEMBLE_ARTICLES_TOOL
  );

  for (const a of result.articles) {
    const pageStart = Math.min(...a.source_pages);
    const pageEnd = Math.max(...a.source_pages);
    const article = await createArticle({
      sourceDocumentId: docId,
      pageStart,
      pageEnd,
      titleOriginal: a.title,
      bodyOriginal: a.body_text,
      publicSuitability: a.public_suitability,
      publicSuitabilityReason: a.suitability_reason,
    });

    if (doc.sourceType === "ganbaru_news") {
      await setArticleRegionTag(article.id, "kodaira", 1, "がんばるニュースは常に小平HP向け", "kodaira");
      if (a.public_suitability !== "not_suitable_internal_only") {
        await enqueueJob({
          jobType: "rewrite",
          relatedArticleId: article.id,
          relatedSourceDocumentId: docId,
          payload: { targetSiteLabel: "小平HP", isDerivative: false },
        });
      }
    } else if (a.public_suitability !== "not_suitable_internal_only") {
      await enqueueJob({
        jobType: "tag_region",
        relatedArticleId: article.id,
        relatedSourceDocumentId: docId,
      });
    }
  }
}

async function handleTagRegion(job: ProcessingJob): Promise<void> {
  const articleId = job.relatedArticleId;
  if (!articleId) throw new Error("tag_region: relatedArticleId がありません");
  const article = await getArticleById(articleId);
  if (!article) throw new Error("対象の記事が見つかりません");

  const result = await callClaudeTool<TagRegionResult>(
    TAG_REGION_SYSTEM_PROMPT,
    buildTagRegionUserPrompt(article.titleOriginal, article.bodyOriginal),
    TAG_REGION_TOOL
  );

  const baseSite: SiteSlug | null = result.base_region_tag === "kitatama_tobu" ? "kitatama-tobu" : null;
  await setArticleRegionTag(articleId, result.base_region_tag, result.base_confidence, result.base_reasoning, baseSite);

  await enqueueJob({
    jobType: "rewrite",
    relatedArticleId: articleId,
    relatedSourceDocumentId: job.relatedSourceDocumentId ?? undefined,
    payload: { targetSiteLabel: "北多摩東部地区委員会HP", isDerivative: false },
  });

  if (result.nishitokyo_derivative_recommended) {
    const derivative = await createArticle({
      sourceDocumentId: article.sourceDocumentId,
      pageStart: Math.min(...article.sourcePages),
      pageEnd: Math.max(...article.sourcePages),
      titleOriginal: article.titleOriginal,
      bodyOriginal: article.bodyOriginal,
      publicSuitability: article.publicSuitability,
      publicSuitabilityReason: article.publicSuitabilityReason,
      derivedFromArticleId: articleId,
    });
    await setArticleRegionTag(
      derivative.id,
      "nishitokyo",
      result.nishitokyo_derivative_confidence ?? result.base_confidence,
      result.nishitokyo_derivative_reasoning ?? "",
      "nishitokyo"
    );
    await enqueueJob({
      jobType: "rewrite",
      relatedArticleId: derivative.id,
      relatedSourceDocumentId: job.relatedSourceDocumentId ?? undefined,
      payload: { targetSiteLabel: "西東京HP", isDerivative: true },
    });
  }
}

async function handleRewrite(job: ProcessingJob): Promise<void> {
  const articleId = job.relatedArticleId;
  if (!articleId) throw new Error("rewrite: relatedArticleId がありません");
  const article = await getArticleById(articleId);
  if (!article) throw new Error("対象の記事が見つかりません");

  const glossary = (await listGlossaryTerms()).map((t) => ({ term: t.term, explanation: t.explanation }));
  const targetSiteLabel = job.payload.targetSiteLabel ?? "北多摩東部地区委員会HP";

  const result = await callClaudeTool<RewriteResult>(
    REWRITE_SYSTEM_PROMPT,
    buildRewriteUserPrompt(article.titleOriginal, article.bodyOriginal, targetSiteLabel, glossary),
    REWRITE_TOOL
  );

  await updateArticle(articleId, { titleRewritten: result.title_rewritten, bodyRewritten: result.body_rewritten });
  await addInternalInfoFlags(
    articleId,
    result.internal_info_flags.map((f) => ({
      quotedText: f.quoted_text,
      category: f.category,
      reason: f.reason,
      presentInRewrite: f.present_in_rewrite,
    }))
  );

  await enqueueJob({
    jobType: "detect_duplicates",
    relatedArticleId: articleId,
    relatedSourceDocumentId: job.relatedSourceDocumentId ?? undefined,
  });
}

async function handleDetectDuplicates(job: ProcessingJob): Promise<void> {
  const articleId = job.relatedArticleId;
  if (!articleId) throw new Error("detect_duplicates: relatedArticleId がありません");
  const article = await getArticleById(articleId);
  if (!article || !article.bodyRewritten) return;

  const candidates = (await listDuplicateCandidates()).filter((c) => c.id !== articleId);
  if (candidates.length === 0) return;

  const result = await callClaudeTool<{ flags: DuplicateFlagResult[] }>(
    DETECT_DUPLICATES_SYSTEM_PROMPT,
    buildDetectDuplicatesUserPrompt(
      {
        title: article.titleRewritten ?? article.titleOriginal,
        bodyText: article.bodyRewritten,
        issueDate: new Date().toISOString().slice(0, 10),
      },
      candidates
    ),
    DETECT_DUPLICATES_TOOL
  );

  await addDuplicateFlags(
    articleId,
    result.flags.map((f) => ({
      similarArticleId: f.candidate_id,
      flagType: f.flag_type,
      similarityScore: f.similarity_score,
      similarityReason: f.similarity_reason,
      recommendedAction: f.recommended_action,
    }))
  );
}

const HANDLERS: Record<ProcessingJob["jobType"], (job: ProcessingJob) => Promise<void>> = {
  render_pages: handleRenderPages,
  extract_page: handleExtractPage,
  assemble_articles: handleAssembleArticles,
  tag_region: handleTagRegion,
  rewrite: handleRewrite,
  detect_duplicates: handleDetectDuplicates,
};

export interface TickResult {
  processed: boolean;
  jobType?: ProcessingJob["jobType"];
  error?: string;
}

// キューの先頭から1件だけ取り出して処理する。呼び出し元（/api/jobs/tick,
// /api/cron/worker）が繰り返し呼ぶことで全体を処理しきる。
export async function processNextJob(): Promise<TickResult> {
  const job = await claimNextJob();
  if (!job) return { processed: false };

  try {
    await HANDLERS[job.jobType](job);
    await markJobDone(job.id);
    return { processed: true, jobType: job.jobType };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobError(job, message);
    return { processed: true, jobType: job.jobType, error: message };
  }
}

export async function enqueueInitialJob(sourceDocumentId: string): Promise<void> {
  await enqueueJob({ jobType: "render_pages", relatedSourceDocumentId: sourceDocumentId });
}
