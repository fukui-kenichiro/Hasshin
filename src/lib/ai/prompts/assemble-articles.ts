// processing_jobs の job_type = 'assemble_articles' で使うプロンプト。
// extract_page で得たページ単位のブロック群（複数ページ分）を受け取り、
// 記事（トピック）単位にグルーピングする。地域タグ付け・リライトは行わない
// （それぞれ tag_region / rewrite ジョブの責務）。
//
// ここでの重要な役割は「掲載可否の一次判定材料」を作ること。
// 実サンプル（過去記事の例）を確認したところ、1号のほぼ全体が
// 党員拡大の内部方針・選挙戦略の内部報告のみで構成されている号もあり、
// その場合は記事全体が「一般公開への転用に適さない」と判定されるべきケースが
// 相応の頻度である。これは要件にある「党員限定/部内資料の除外」の
// 記事全体版として扱う。

import type { ExtractedPage } from "./extract-page";

export const ASSEMBLE_ARTICLES_SYSTEM_PROMPT = `あなたは、ページ単位で構造化されたニュースレターのブロック群を受け取り、記事（トピック）単位にグルーピングするアシスタントです。

入力は複数ページ分の { page_number, masthead, blocks[] } の配列です。1つの記事（トピック）が1ページに収まる場合もあれば、複数ページ・複数段にまたがる場合もあります。逆に1ページに複数の独立した記事が並んでいる場合もあります。

必ず以下のJSONスキーマで出力してください（説明文は不要、JSONのみ）：

{
  "articles": [
    {
      "source_pages": number[],           // このトピックが含まれるページ番号
      "block_ids": string[],              // 採用したブロックのid（元の順序で）
      "title": string,                    // 見出しブロックから。見出しが複数階層ある場合は主見出しを採用
      "body_text": string,                // 本文ブロックを読む順序に沿って結合したもの。画像は "[画像: 説明]" の形でその位置に埋め込む
      "topic_summary": string,            // このトピックの内容を一文で要約（社内向けの記録用途。公開文面ではない）
      "contains_internal_marker": boolean, // 採用したブロックのいずれかで contains_internal_marker が true か、masthead に internal_marker_text があるか
      "internal_marker_notes": string[],  // 該当箇所の短い引用（複数可）
      "public_suitability": "rewrite_candidate" | "not_suitable_internal_only" | "needs_human_judgment",
      "suitability_reason": string        // 上記判定の理由を一文で
    }
  ]
}

public_suitability の判定基準：
- "not_suitable_internal_only": 記事の主旨そのものが、党員拡大の働きかけ数・支部ごとの読者拡大実績・入党目標・演説会参加人数の内部集計といった**具体的な内部限定の数値**、または支部長・地区委員会など特定内部者への**具体的な内部指示**（例:「支部会議で読み合わせてください」「◯◯を地区委員会に提出すること」）である場合。特定の個人を識別しうる入党エピソード等（personal_privacy）もここに含める。
- "rewrite_candidate": 地域の行事の開催報告、市政に対する政策的な主張・要望（例: 国保税、子育て支援、公共交通、公共施設のあり方など）、選挙の候補者紹介・演説会の開催報告など、**内部限定の数値・具体的な内部指示を除けば**一般読者向けに書き直せる内容。「◯人の当選をめざす」「必ず送り出そう」といった選挙運動の一般的な呼びかけ表現は、それ自体では not_suitable の理由にしない（政党が自らの公式サイトで候補者や政策を公開することは通常の広報活動であり、内部限定情報ではない）。表現の党内的なトーンは rewrite ジョブ側で調整するので、ここでは「内部限定の具体的事実（数値・指示・個人情報）が含まれているか」だけを基準に判定する。
- "needs_human_judgment": 上記のいずれか判断がつかない場合（例: 国政・外交に関する党の見解の紹介で、地域トピックではないが、内部限定情報も含まない場合）。機械的に公開可否を決めず、人が確認すべきものとしてこの区分にする。

判定時の注意：
- masthead の「部内資料」表記は、このニュースレター自体が内部配布物であることを示す定型句であり、**単独では not_suitable の根拠にしない**（ほぼ全号に付いているため、これだけで判定すると大半の記事が not_suitable になってしまう）。判定は記事本文の内容で行うこと。
- 「◯人の当選が必要である」「◯◯の実現を求める」等の政策・選挙関連の一般的な文言は internal_marker_notes に含めない。internal_marker_notes に載せるのは、具体的な数値・氏名・指示など、除外すべき固有の内部情報のみ。

このプロンプトの役割はグルーピングと一次判定のみで、リライト文の作成や地域タグ（北多摩東部/西東京/小平/複数/判定不能）の決定は行わない。`;

export function buildAssembleArticlesUserPrompt(pages: ExtractedPage[]): string {
  return JSON.stringify(pages, null, 2);
}

// Tool Use（Structured Outputs）用スキーマ。理由は extract-page.ts 参照。
export const ASSEMBLE_ARTICLES_TOOL = {
  name: "submit_assembled_articles",
  description: "記事（トピック）単位にグルーピングした結果を送信する",
  input_schema: {
    type: "object",
    required: ["articles"],
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          required: [
            "source_pages",
            "block_ids",
            "title",
            "body_text",
            "topic_summary",
            "contains_internal_marker",
            "internal_marker_notes",
            "public_suitability",
            "suitability_reason",
          ],
          properties: {
            source_pages: { type: "array", items: { type: "integer" } },
            block_ids: { type: "array", items: { type: "string" } },
            title: { type: "string" },
            body_text: { type: "string" },
            topic_summary: { type: "string" },
            contains_internal_marker: { type: "boolean" },
            internal_marker_notes: { type: "array", items: { type: "string" } },
            public_suitability: {
              type: "string",
              enum: ["rewrite_candidate", "not_suitable_internal_only", "needs_human_judgment"],
            },
            suitability_reason: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export interface AssembledArticle {
  source_pages: number[];
  block_ids: string[];
  title: string;
  body_text: string;
  topic_summary: string;
  contains_internal_marker: boolean;
  internal_marker_notes: string[];
  public_suitability:
    | "rewrite_candidate"
    | "not_suitable_internal_only"
    | "needs_human_judgment";
  suitability_reason: string;
}
