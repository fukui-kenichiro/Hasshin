import type {
  ArticleStatus,
  DuplicateFlagType,
  PublicSuitability,
  RegionTag,
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
