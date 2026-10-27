// supabase/migrations/*.sql に対応するアプリ内の型定義。
// src/lib/data/store.ts が、この型でSupabase(Postgres)とやり取りする。

export type SiteSlug = "kitatama-tobu" | "nishitokyo" | "kodaira";

export interface Site {
  id: string;
  slug: SiteSlug;
  name: string;
  baseUrl: string | null;
  wpApiKey: string | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor";
}

// 党内用語辞典。リライト時にAIが参照し、単に削除・平易化するのではなく
// 「用語（説明）」の形で解説を添えるために使う（例: 「青本」→
// 「青本（『Q＆A 共産主義と自由』）」）。カテゴリ・用語ともに利用者が追加できる。
// term に "○" を含めることで数字が入る用語にも対応する
// （例: term "○中総" / explanation "第○回中央委員会総会" → 本文の「5中総」に
// 対して「5中総（第5回中央委員会総会）」を組み立てる）。
export interface GlossaryCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface GlossaryTerm {
  id: string;
  categoryId: string;
  term: string;
  explanation: string;
  createdAt: string;
}

export type SourceType = "suishin_news" | "ganbaru_news";
export type SourceDocumentStatus = "uploaded" | "processing" | "done" | "error";

export interface SourceDocument {
  id: string;
  originalFilename: string;
  storagePath: string;
  sourceType: SourceType;
  issueDate: string | null;
  pageCount: number | null;
  pageCountProcessed: number;
  status: SourceDocumentStatus;
  uploadedAt: string;
}

export type SourcePageStatus = "pending" | "processing" | "done" | "error";

export interface SourcePage {
  id: string;
  sourceDocumentId: string;
  pageNumber: number;
  imageStoragePath: string | null;
  visionRawJson: unknown;
  status: SourcePageStatus;
  errorMessage: string | null;
}

export type RegionTag =
  | "kitatama_tobu"
  | "nishitokyo"
  | "kodaira"
  | "multiple"
  | "undetermined";

export type ArticleStatus = "pending_review" | "approved" | "rejected" | "exported";

export type WpPublishStatus = "not_sent" | "pending" | "sent" | "error" | "blocked";

export type PublicSuitability =
  | "rewrite_candidate"
  | "not_suitable_internal_only"
  | "needs_human_judgment";

export interface Article {
  id: string;
  sourceDocumentId: string;
  sourcePages: number[];

  titleOriginal: string;
  bodyOriginal: string;

  titleRewritten: string | null;
  bodyRewritten: string | null;

  publicSuitability: PublicSuitability;
  publicSuitabilityReason: string;

  regionTag: RegionTag;
  regionTagConfidence: number | null;
  regionTagReason: string | null;
  regionTagSource: "ai" | "manual";
  targetSiteSlug: SiteSlug | null;

  derivedFromArticleId: string | null;

  status: ArticleStatus;

  wpPostId: string | null;
  wpPostUrl: string | null;
  wpPublishStatus: WpPublishStatus;
  wpPublishError: string | null;
  wpPublishedAt: string | null;

  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export type InternalInfoCategory =
  | "membership_count"
  | "dues_rate"
  | "reader_count"
  | "fundraising_rate"
  | "internal_directive"
  | "member_only_label"
  | "personal_privacy"
  | "other";

export type InternalInfoStatus = "unresolved" | "confirmed_safe" | "removed";

export interface InternalInfoFlag {
  id: string;
  articleId: string;
  quotedText: string;
  category: InternalInfoCategory;
  reason: string;
  status: InternalInfoStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export type DuplicateFlagType = "duplicate_content" | "recycled_appeal";
export type DuplicateFlagStatus = "open" | "confirmed" | "dismissed";

export interface DuplicateFlag {
  id: string;
  articleId: string;
  similarArticleId: string | null;
  similarArticleTitle: string;
  flagType: DuplicateFlagType;
  similarityScore: number;
  similarityReason: string;
  recommendedAction: string;
  status: DuplicateFlagStatus;
}

export type ExportFormat = "html" | "markdown" | "plain_text";

export type JobType =
  | "render_pages"
  | "extract_page"
  | "assemble_articles"
  | "tag_region"
  | "rewrite"
  | "detect_duplicates"
  | "publish_to_wp";

export type JobStatus = "pending" | "in_progress" | "done" | "error" | "retrying";

export interface ProcessingJobPayload {
  // extract_page
  sourcePageId?: string;
  pageNumber?: number;
  // rewrite
  targetSiteLabel?: string;
  isDerivative?: boolean;
  // 「党内限定」等の判定で自動リライトされなかった記事を、担当者の指示で
  // 強制的にリライトする際に付与する追加条件（プロンプトにそのまま渡す）
  rewriteCondition?: string;
  // tag_region / rewrite / detect_duplicates 共通
  sourceType?: SourceType;
}

export interface ProcessingJob {
  id: string;
  jobType: JobType;
  payload: ProcessingJobPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  relatedSourceDocumentId: string | null;
  relatedSourcePageId: string | null;
  relatedArticleId: string | null;
}

export type LineDraftSourceType = "manual" | "article";
export type LineDraftStatus = "draft" | "approved" | "scheduled" | "sending" | "sent" | "failed";

export interface LineDraft {
  id: string;
  sourceType: LineDraftSourceType;
  sourceArticleId: string | null;
  sourceText: string;
  messageText: string;
  aiNotes: string[];
  status: LineDraftStatus;
  approvedAt: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  deliveryError: string | null;
  deliveryAttempts: number;
  retryKey: string;
  createdAt: string;
  updatedAt: string;
}
