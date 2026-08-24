// Supabase(Postgres)を実データストアとして使うデータアクセス層。
// マイルストーン4まではインメモリ実装だったが、マイルストーン5でSupabaseに
// 接続した。呼び出し側（API Routes・ページ）のインターフェースは変えていない。

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Article,
  ArticleStatus,
  DuplicateFlag,
  GlossaryCategory,
  GlossaryTerm,
  InternalInfoFlag,
  JobType,
  ProcessingJob,
  ProcessingJobPayload,
  RegionTag,
  Site,
  SourceDocument,
  SourcePage,
  SourceType,
  User,
} from "@/lib/types/domain";

function sb() {
  return getSupabaseServerClient();
}

// ---- マッパー: DBの snake_case 行 <-> アプリの camelCase 型 ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSite(row: any): Site {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    baseUrl: row.base_url ?? null,
    wpApiKey: row.wp_api_key ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(row: any): User {
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSourceDocument(row: any): SourceDocument {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    sourceType: row.source_type,
    issueDate: row.issue_date,
    pageCount: row.page_count,
    pageCountProcessed: row.page_count_processed,
    status: row.status,
    uploadedAt: row.uploaded_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSourcePage(row: any): SourcePage {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    pageNumber: row.page_number,
    imageStoragePath: row.image_storage_path,
    visionRawJson: row.vision_raw_json,
    status: row.status,
    errorMessage: row.error_message,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArticle(row: any): Article {
  const start = row.page_start ?? null;
  const end = row.page_end ?? start;
  const sourcePages =
    start === null ? [] : Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    sourcePages,
    titleOriginal: row.title_original ?? "",
    bodyOriginal: row.body_original ?? "",
    titleRewritten: row.title_rewritten,
    bodyRewritten: row.body_rewritten,
    publicSuitability: row.public_suitability,
    publicSuitabilityReason: row.public_suitability_reason ?? "",
    regionTag: row.region_tag,
    regionTagConfidence: row.region_tag_confidence,
    regionTagReason: row.region_tag_reason,
    regionTagSource: row.region_tag_source,
    targetSiteSlug: row.target_site?.slug ?? null,
    derivedFromArticleId: row.derived_from_article_id,
    status: row.status,
    wpPostId: row.wp_post_id ?? null,
    wpPostUrl: row.wp_post_url ?? null,
    wpPublishStatus: row.wp_publish_status ?? "not_sent",
    wpPublishError: row.wp_publish_error ?? null,
    wpPublishedAt: row.wp_published_at ?? null,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInternalInfoFlag(row: any): InternalInfoFlag {
  return {
    id: row.id,
    articleId: row.article_id,
    quotedText: row.quoted_text,
    category: row.category,
    reason: row.reason ?? "",
    status: row.status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDuplicateFlag(row: any): DuplicateFlag {
  return {
    id: row.id,
    articleId: row.article_id,
    similarArticleId: row.similar_article_id,
    similarArticleTitle:
      row.similar_article?.title_rewritten ?? row.similar_article?.title_original ?? "(削除された記事)",
    flagType: row.flag_type,
    similarityScore: Number(row.similarity_score ?? 0),
    similarityReason: row.similarity_reason ?? "",
    recommendedAction: row.recommended_action,
    status: row.status,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGlossaryCategory(row: any): GlossaryCategory {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGlossaryTerm(row: any): GlossaryTerm {
  return {
    id: row.id,
    categoryId: row.category_id,
    term: row.term,
    explanation: row.explanation,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJob(row: any): ProcessingJob {
  return {
    id: row.id,
    jobType: row.job_type,
    payload: (row.payload ?? {}) as ProcessingJobPayload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    relatedSourceDocumentId: row.related_source_document_id,
    relatedSourcePageId: row.related_source_page_id,
    relatedArticleId: row.related_article_id,
  };
}

// ---- Auth ----

export async function findUserByEmail(email: string): Promise<User | null> {
  const { data } = await sb().from("users").select("*").eq("email", email).maybeSingle();
  return data ? toUser(data) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data } = await sb().from("users").select("*").eq("id", id).maybeSingle();
  return data ? toUser(data) : null;
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const { data } = await sb().from("users").select("*").eq("email", email).maybeSingle();
  if (!data) return null;
  const ok = await bcrypt.compare(password, data.password_hash);
  return ok ? toUser(data) : null;
}

export async function updateUserCredentials(
  userId: string,
  patch: { email?: string; displayName?: string; password?: string }
): Promise<User | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  if (patch.email) update.email = patch.email;
  if (patch.displayName) update.display_name = patch.displayName;
  if (patch.password) update.password_hash = await bcrypt.hash(patch.password, 10);
  if (Object.keys(update).length === 0) return getUserById(userId);

  const { data, error } = await sb().from("users").update(update).eq("id", userId).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toUser(data) : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const { error } = await sb().from("sessions").insert({ id: token, user_id: userId, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const { data: session } = await sb()
    .from("sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("id", token)
    .maybeSingle();
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  return getUserById(session.user_id);
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await sb().from("sessions").delete().eq("id", token);
}

// ---- Sites ----

export async function listSites(): Promise<Site[]> {
  const { data } = await sb().from("sites").select("*").order("name");
  return (data ?? []).map(toSite);
}

async function getSiteIdBySlug(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const { data } = await sb().from("sites").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

export async function getSiteBySlug(slug: SiteSlug_): Promise<Site | null> {
  const { data } = await sb().from("sites").select("*").eq("slug", slug).maybeSingle();
  return data ? toSite(data) : null;
}

export async function updateSite(
  id: string,
  patch: Partial<{ baseUrl: string | null; wpApiKey: string | null }>
): Promise<Site | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  if (patch.baseUrl !== undefined) update.base_url = patch.baseUrl;
  if (patch.wpApiKey !== undefined) update.wp_api_key = patch.wpApiKey;
  const { data, error } = await sb().from("sites").update(update).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSite(data) : null;
}

// ---- Source documents ----

export async function createSourceDocument(input: {
  id?: string;
  originalFilename: string;
  storagePath: string;
  sourceType: SourceType;
  uploadedBy: string;
}): Promise<SourceDocument> {
  const { data, error } = await sb()
    .from("source_documents")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      original_filename: input.originalFilename,
      storage_path: input.storagePath,
      source_type: input.sourceType,
      uploaded_by: input.uploadedBy,
      status: "processing",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toSourceDocument(data);
}

export async function getSourceDocumentById(id: string): Promise<SourceDocument | null> {
  const { data } = await sb().from("source_documents").select("*").eq("id", id).maybeSingle();
  return data ? toSourceDocument(data) : null;
}

export async function listSourceDocuments(): Promise<SourceDocument[]> {
  const { data } = await sb().from("source_documents").select("*").order("uploaded_at", { ascending: false });
  return (data ?? []).map(toSourceDocument);
}

export async function updateSourceDocument(
  id: string,
  patch: Partial<{ status: SourceDocument["status"]; pageCount: number; pageCountProcessed: number }>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  if (patch.status) update.status = patch.status;
  if (patch.pageCount !== undefined) update.page_count = patch.pageCount;
  if (patch.pageCountProcessed !== undefined) update.page_count_processed = patch.pageCountProcessed;
  await sb().from("source_documents").update(update).eq("id", id);
}

export async function incrementPageCountProcessed(id: string): Promise<void> {
  const doc = await getSourceDocumentById(id);
  if (!doc) return;
  await updateSourceDocument(id, { pageCountProcessed: doc.pageCountProcessed + 1 });
}

// ---- Source pages ----

export async function createSourcePages(
  documentId: string,
  count: number
): Promise<SourcePage[]> {
  const rows = Array.from({ length: count }, (_, i) => ({
    source_document_id: documentId,
    page_number: i + 1,
  }));
  const { data, error } = await sb().from("source_pages").insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSourcePage);
}

export async function getSourcePageById(id: string): Promise<SourcePage | null> {
  const { data } = await sb().from("source_pages").select("*").eq("id", id).maybeSingle();
  return data ? toSourcePage(data) : null;
}

export async function listSourcePages(documentId: string): Promise<SourcePage[]> {
  const { data } = await sb()
    .from("source_pages")
    .select("*")
    .eq("source_document_id", documentId)
    .order("page_number");
  return (data ?? []).map(toSourcePage);
}

export async function updateSourcePage(
  id: string,
  patch: Partial<{
    imageStoragePath: string;
    visionRawJson: unknown;
    status: SourcePage["status"];
    errorMessage: string | null;
  }>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  if (patch.imageStoragePath !== undefined) update.image_storage_path = patch.imageStoragePath;
  if (patch.visionRawJson !== undefined) update.vision_raw_json = patch.visionRawJson;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.status === "done" || patch.status === "error") update.processed_at = new Date().toISOString();
  await sb().from("source_pages").update(update).eq("id", id);
}

// ---- Articles ----

export async function createArticle(input: {
  sourceDocumentId: string;
  pageStart: number;
  pageEnd: number;
  titleOriginal: string;
  bodyOriginal: string;
  publicSuitability: Article["publicSuitability"];
  publicSuitabilityReason: string;
  derivedFromArticleId?: string | null;
  regionTag?: RegionTag;
}): Promise<Article> {
  const { data, error } = await sb()
    .from("articles")
    .insert({
      source_document_id: input.sourceDocumentId,
      page_start: input.pageStart,
      page_end: input.pageEnd,
      title_original: input.titleOriginal,
      body_original: input.bodyOriginal,
      public_suitability: input.publicSuitability,
      public_suitability_reason: input.publicSuitabilityReason,
      derived_from_article_id: input.derivedFromArticleId ?? null,
      // 地域タグが未確定のまま作られる記事（tag_regionジョブを実行しない
      // not_suitable_internal_only 等）は「北多摩東部」を既定にする
      // （ユーザー指示：「判定不能」を極力出さない）
      region_tag: input.regionTag ?? "kitatama_tobu",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toArticle(data);
}

export async function getArticleById(id: string): Promise<Article | null> {
  const { data } = await sb()
    .from("articles")
    .select("*, target_site:sites!articles_target_site_id_fkey(slug)")
    .eq("id", id)
    .maybeSingle();
  return data ? toArticle(data) : null;
}

export async function listArticles(filter?: {
  status?: ArticleStatus;
  regionTag?: RegionTag;
}): Promise<Article[]> {
  let query = sb()
    .from("articles")
    .select("*, target_site:sites!articles_target_site_id_fkey(slug)")
    .order("created_at", { ascending: false });
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.regionTag) query = query.eq("region_tag", filter.regionTag);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toArticle);
}

export async function listArticlesBySourceDocument(documentId: string): Promise<Article[]> {
  const { data } = await sb()
    .from("articles")
    .select("*, target_site:sites!articles_target_site_id_fkey(slug)")
    .eq("source_document_id", documentId);
  return (data ?? []).map(toArticle);
}

export async function updateArticle(id: string, patch: Partial<Article>): Promise<Article | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { updated_at: new Date().toISOString() };
  if (patch.titleRewritten !== undefined) update.title_rewritten = patch.titleRewritten;
  if (patch.bodyRewritten !== undefined) update.body_rewritten = patch.bodyRewritten;
  if (patch.publicSuitability !== undefined) update.public_suitability = patch.publicSuitability;
  if (patch.publicSuitabilityReason !== undefined) update.public_suitability_reason = patch.publicSuitabilityReason;
  if (patch.regionTag !== undefined) {
    update.region_tag = patch.regionTag;
    update.region_tag_source = "manual";
  }
  if (patch.regionTagConfidence !== undefined) update.region_tag_confidence = patch.regionTagConfidence;
  if (patch.regionTagReason !== undefined) update.region_tag_reason = patch.regionTagReason;
  if (patch.targetSiteSlug !== undefined) update.target_site_id = await getSiteIdBySlug(patch.targetSiteSlug);
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.reviewedBy !== undefined) update.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) update.reviewed_at = patch.reviewedAt;
  if (patch.approvedBy !== undefined) update.approved_by = patch.approvedBy;
  if (patch.approvedAt !== undefined) update.approved_at = patch.approvedAt;
  if (patch.wpPostId !== undefined) update.wp_post_id = patch.wpPostId;
  if (patch.wpPostUrl !== undefined) update.wp_post_url = patch.wpPostUrl;
  if (patch.wpPublishStatus !== undefined) update.wp_publish_status = patch.wpPublishStatus;
  if (patch.wpPublishError !== undefined) update.wp_publish_error = patch.wpPublishError;
  if (patch.wpPublishedAt !== undefined) update.wp_published_at = patch.wpPublishedAt;

  const { data, error } = await sb()
    .from("articles")
    .update(update)
    .eq("id", id)
    .select("*, target_site:sites!articles_target_site_id_fkey(slug)")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toArticle(data) : null;
}

// tag_region ジョブ専用: 地域タグとサイト自動割当を一括で設定する
export async function setArticleRegionTag(
  id: string,
  regionTag: RegionTag,
  confidence: number,
  reason: string,
  siteSlug: SiteSlug_ | null
): Promise<void> {
  const siteId = await getSiteIdBySlug(siteSlug);
  await sb()
    .from("articles")
    .update({
      region_tag: regionTag,
      region_tag_confidence: confidence,
      region_tag_reason: reason,
      target_site_id: siteId,
    })
    .eq("id", id);
}
type SiteSlug_ = "kitatama-tobu" | "nishitokyo" | "kodaira";

// 記事の完全削除（重大な個人情報の混入など、事故対応のための機能）。
// 承認・却下いずれの状態からでも実行できる。内部情報フラグ・重複フラグ・
// 版履歴・関連ジョブは外部キーの on delete cascade で連動して消える。
// WordPress側に既に下書きが送信済みの場合、その削除は呼び出し側
// （API route）がプラグインのDELETEエンドポイントを呼んで別途行う。
export async function deleteArticle(id: string): Promise<void> {
  const { error } = await sb().from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Internal info flags ----

export async function addInternalInfoFlags(
  articleId: string,
  flags: { quotedText: string; category: InternalInfoFlag["category"]; reason: string; presentInRewrite: boolean }[]
): Promise<void> {
  if (flags.length === 0) return;
  const now = new Date().toISOString();
  const rows = flags.map((f) => ({
    article_id: articleId,
    quoted_text: f.quotedText,
    category: f.category,
    reason: f.reason,
    status: f.presentInRewrite ? "unresolved" : "removed",
    resolved_by: f.presentInRewrite ? null : null,
    resolved_at: f.presentInRewrite ? null : now,
  }));
  const { error } = await sb().from("internal_info_flags").insert(rows);
  if (error) throw new Error(error.message);
}

export async function listInternalInfoFlags(articleId: string): Promise<InternalInfoFlag[]> {
  const { data } = await sb().from("internal_info_flags").select("*").eq("article_id", articleId);
  return (data ?? []).map(toInternalInfoFlag);
}

export async function updateInternalInfoFlag(
  id: string,
  patch: { status: InternalInfoFlag["status"]; resolvedBy: string }
): Promise<InternalInfoFlag | null> {
  const { data, error } = await sb()
    .from("internal_info_flags")
    .update({ status: patch.status, resolved_by: patch.resolvedBy, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toInternalInfoFlag(data) : null;
}

export async function hasUnresolvedInternalInfo(articleId: string): Promise<boolean> {
  const { count } = await sb()
    .from("internal_info_flags")
    .select("id", { count: "exact", head: true })
    .eq("article_id", articleId)
    .eq("status", "unresolved");
  return (count ?? 0) > 0;
}

// ---- Duplicate flags ----

export async function addDuplicateFlags(
  articleId: string,
  flags: {
    similarArticleId: string | null;
    flagType: DuplicateFlag["flagType"];
    similarityScore: number;
    similarityReason: string;
    recommendedAction: string;
  }[]
): Promise<void> {
  if (flags.length === 0) return;
  const rows = flags.map((f) => ({
    article_id: articleId,
    similar_article_id: f.similarArticleId,
    flag_type: f.flagType,
    similarity_score: f.similarityScore,
    similarity_reason: f.similarityReason,
    recommended_action: f.recommendedAction,
  }));
  const { error } = await sb().from("duplicate_flags").insert(rows);
  if (error) throw new Error(error.message);
}

export async function listDuplicateFlags(articleId: string): Promise<DuplicateFlag[]> {
  const { data } = await sb()
    .from("duplicate_flags")
    .select("*, similar_article:articles!duplicate_flags_similar_article_id_fkey(title_rewritten, title_original)")
    .eq("article_id", articleId);
  return (data ?? []).map(toDuplicateFlag);
}

export async function updateDuplicateFlag(
  id: string,
  patch: { status: DuplicateFlag["status"] }
): Promise<DuplicateFlag | null> {
  const { data, error } = await sb()
    .from("duplicate_flags")
    .update({ status: patch.status })
    .eq("id", id)
    .select("*, similar_article:articles!duplicate_flags_similar_article_id_fkey(title_rewritten, title_original)")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDuplicateFlag(data) : null;
}

// 重複検出の候補として使う「既存の承認・書き出しずみ記事」の一覧
export async function listDuplicateCandidates(limit = 20): Promise<
  { id: string; title: string; summary: string; issueDate: string; regionTag: RegionTag }[]
> {
  const { data } = await sb()
    .from("articles")
    .select("id, title_rewritten, body_rewritten, updated_at, region_tag")
    .in("status", ["approved", "exported"])
    .not("title_rewritten", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title_rewritten as string,
    summary: (row.body_rewritten ?? "").slice(0, 200),
    issueDate: (row.updated_at as string).slice(0, 10),
    regionTag: row.region_tag,
  }));
}

// ---- Glossary ----

export async function listGlossaryCategories(): Promise<GlossaryCategory[]> {
  const { data } = await sb().from("glossary_categories").select("*").order("created_at");
  return (data ?? []).map(toGlossaryCategory);
}

export async function listGlossaryTerms(): Promise<GlossaryTerm[]> {
  const { data } = await sb().from("glossary_terms").select("*").order("created_at");
  return (data ?? []).map(toGlossaryTerm);
}

export async function addGlossaryCategory(name: string): Promise<GlossaryCategory> {
  const { data, error } = await sb().from("glossary_categories").insert({ name }).select().single();
  if (error) throw new Error(error.message);
  return toGlossaryCategory(data);
}

export async function addGlossaryTerm(
  categoryId: string,
  term: string,
  explanation: string
): Promise<GlossaryTerm | null> {
  const { data, error } = await sb()
    .from("glossary_terms")
    .insert({ category_id: categoryId, term, explanation })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toGlossaryTerm(data) : null;
}

// ---- Processing jobs ----

export async function enqueueJob(input: {
  jobType: JobType;
  payload?: ProcessingJobPayload;
  relatedSourceDocumentId?: string;
  relatedSourcePageId?: string;
  relatedArticleId?: string;
  priority?: number;
}): Promise<ProcessingJob> {
  const { data, error } = await sb()
    .from("processing_jobs")
    .insert({
      job_type: input.jobType,
      payload: input.payload ?? {},
      related_source_document_id: input.relatedSourceDocumentId ?? null,
      related_source_page_id: input.relatedSourcePageId ?? null,
      related_article_id: input.relatedArticleId ?? null,
      priority: input.priority ?? 100,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toJob(data);
}

export async function claimNextJob(): Promise<ProcessingJob | null> {
  const { data, error } = await sb().rpc("claim_next_job");
  if (error) throw new Error(error.message);
  if (!data || !data.id) return null;
  return toJob(data);
}

export async function markJobDone(id: string): Promise<void> {
  await sb().from("processing_jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", id);
}

export async function markJobError(job: ProcessingJob, message: string): Promise<void> {
  const willRetry = job.attempts < job.maxAttempts;
  await sb()
    .from("processing_jobs")
    .update({
      status: willRetry ? "pending" : "error",
      last_error: message,
      run_after: willRetry ? new Date(Date.now() + 5000 * job.attempts).toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

export async function countPendingJobsForDocument(documentId: string): Promise<number> {
  const { count } = await sb()
    .from("processing_jobs")
    .select("id", { count: "exact", head: true })
    .eq("related_source_document_id", documentId)
    .in("status", ["pending", "in_progress", "retrying"]);
  return count ?? 0;
}
