import type {
  ArticleStatus,
  DuplicateFlagType,
  LineDraftStatus,
  PublicSuitability,
  RegionTag,
  WpPublishStatus,
} from "@/lib/types/domain";

export const REGION_LABEL: Record<RegionTag, string> = {
  kitatama_tobu: "北多摩東部",
  nishitokyo: "西東京",
  kodaira: "小平",
  multiple: "複数",
  undetermined: "判定不能",
};

export const REGION_BADGE_CLASS: Record<RegionTag, string> = {
  kitatama_tobu: "bg-hs-kitatama-bg text-hs-kitatama-text border-hs-kitatama-border",
  nishitokyo: "bg-hs-nishitokyo-bg text-hs-nishitokyo-text border-hs-nishitokyo-border",
  kodaira: "bg-hs-kodaira-bg text-hs-kodaira-text border-hs-kodaira-border",
  multiple: "bg-hs-multiple-bg text-hs-multiple-text border-hs-multiple-border",
  undetermined: "bg-hs-stone-100 text-hs-text-secondary border-hs-stone-300",
};

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  pending_review: "確認待ち",
  approved: "承認ずみ",
  rejected: "却下ずみ",
  exported: "書き出しずみ",
};

export const STATUS_BADGE_CLASS: Record<ArticleStatus, string> = {
  pending_review: "bg-hs-warn-bg text-hs-warn-text border-hs-warn-border",
  approved: "bg-hs-success-bg text-hs-success-text border-hs-success-border",
  rejected: "bg-hs-danger-bg text-hs-danger-text border-hs-danger-border",
  exported: "bg-hs-stone-100 text-hs-stone-600 border-hs-stone-300",
};

export const SUITABILITY_LABEL: Record<PublicSuitability, string> = {
  rewrite_candidate: "公開できそう",
  not_suitable_internal_only: "党内限定・非公開推奨",
  needs_human_judgment: "要確認（判断が必要）",
};

export const SUITABILITY_BADGE_CLASS: Record<PublicSuitability, string> = {
  rewrite_candidate: "bg-hs-success-bg text-hs-success-text border-hs-success-border",
  not_suitable_internal_only: "bg-hs-danger-bg text-hs-danger-text border-hs-danger-border",
  needs_human_judgment: "bg-hs-warn-bg text-hs-warn-text border-hs-warn-border",
};

export const DUPLICATE_FLAG_LABEL: Record<DuplicateFlagType, string> = {
  duplicate_content: "重複記事",
  recycled_appeal: "類似の呼びかけの繰り返し",
};

export const WP_PUBLISH_STATUS_LABEL: Record<WpPublishStatus, string> = {
  not_sent: "未送信",
  pending: "送信中…",
  sent: "WordPressに送信ずみ（下書き）",
  error: "送信に失敗しました",
  blocked: "送信できません",
};

export const WP_PUBLISH_STATUS_BADGE_CLASS: Record<WpPublishStatus, string> = {
  not_sent: "bg-hs-stone-100 text-hs-text-secondary border-hs-stone-300",
  pending: "bg-hs-warn-bg text-hs-warn-text border-hs-warn-border",
  sent: "bg-hs-success-bg text-hs-success-text border-hs-success-border",
  error: "bg-hs-danger-bg text-hs-danger-text border-hs-danger-border",
  blocked: "bg-hs-danger-bg text-hs-danger-text border-hs-danger-border",
};

export const LINE_STATUS_LABEL: Record<LineDraftStatus, string> = {
  draft: "文案の確認待ち",
  approved: "承認ずみ（配信日時は未設定）",
  scheduled: "配信予約ずみ",
  sending: "配信中",
  sent: "配信ずみ",
  failed: "配信に失敗",
};

export const LINE_STATUS_BADGE_CLASS: Record<LineDraftStatus, string> = {
  draft: "bg-hs-warn-bg text-hs-warn-text border-hs-warn-border",
  approved: "bg-hs-success-bg text-hs-success-text border-hs-success-border",
  scheduled: "bg-hs-kitatama-bg text-hs-kitatama-text border-hs-kitatama-border",
  sending: "bg-hs-warn-bg text-hs-warn-text border-hs-warn-border",
  sent: "bg-hs-stone-100 text-hs-stone-600 border-hs-stone-300",
  failed: "bg-hs-danger-bg text-hs-danger-text border-hs-danger-border",
};
