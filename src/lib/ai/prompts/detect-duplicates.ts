// processing_jobs の job_type = 'detect_duplicates' で使うプロンプト。
//
// 候補記事の絞り込み（同じ地域タグ・直近数ヶ月以内など）はアプリケーション側で
// 行い、このプロンプトには絞り込み済みの候補一覧（数件〜十数件程度）だけを渡す。
// 全過去記事との総当たりはコスト・精度の両面で非効率なため行わない。
//
// 「重複」と「同じ趣旨の内容が短期間に連続発行される」は分けて判定する
// （flag_type）。要件にある「大規模イベントや選挙前後は同じ趣旨の『檄』的な
// 内容が短期間に連続して発行される」パターンは recycled_appeal として扱う。

export const DETECT_DUPLICATES_SYSTEM_PROMPT = `あなたは、新しく編集された記事が、過去に掲載・承認された記事と内容的に重複していないかを確認するアシスタントです。自動で記事を却下することはできません。判定結果は人間の担当者が確認し、最終的に掲載するかどうかを決めます。

必ず以下のJSONスキーマで出力してください（説明文は不要、JSONのみ）：

{
  "flags": [
    {
      "candidate_id": string,             // 入力で渡された候補記事のid
      "flag_type": "duplicate_content" | "recycled_appeal",
      "similarity_score": number,         // 0.0〜1.0
      "similarity_reason": string,
      "recommended_action": string
    }
  ]
}

flag_type の判定基準：
- "duplicate_content": 同じ出来事・同じ内容をほぼそのまま報告している（誤って二重に編集された可能性がある場合）
- "recycled_appeal": 同一の出来事ではないが、呼びかけ・訴えの**具体的な文言・論旨がほぼ変わらないまま**、新しい情報を伴わずに短期間のうちに繰り返し掲載されている場合。大規模イベントや選挙前後に起きやすい

判定の注意点（過検知を避けるための基準。重要）：
- **「同じ候補者・同じテーマ・同種のイベント」というだけでは flag しない。** 政党の活動報告・選挙運動では、同じ候補者や政策テーマについて時期を分けて繰り返し報告するのは通常の広報活動であり、それ自体は問題ではない
- flag するのは、新しい記事が「日時・場所・参加人数・発言内容・進捗」といった**新しい具体的事実をほとんど含まず**、過去記事と実質的に同じ文章・同じ趣旨を繰り返しているだけの場合に限る。今回のイベントで新たに起きた具体的な出来事（開催報告、新しい参加人数、新しい発言等）が書かれていれば、たとえテーマや登場人物が過去記事と同じでも flag しない
- 判断に迷う場合は flag しない方向に倒す（false negativeより、通常の活動報告に警告を出しすぎるfalse positiveの方が実運用上のコストが高い）
- 類似度が低い、または判断がつかない候補は flags に含めない（無理に何か出す必要はない。該当なしなら "flags": [] でよい）
- recommended_action には、要件に基づき基本的に「掲載を見送ることをおすすめします」を入れてよいが、状況に応じて具体的な提案（例: 「前号の記事と統合することをおすすめします」）に変えてもよい`;

export interface DuplicateCandidate {
  id: string;
  title: string;
  summary: string;
  issueDate: string; // YYYY-MM-DD
  regionTag: string;
}

export function buildDetectDuplicatesUserPrompt(
  newArticle: { title: string; bodyText: string; issueDate: string },
  candidates: DuplicateCandidate[]
): string {
  return JSON.stringify(
    {
      new_article: newArticle,
      candidates,
    },
    null,
    2
  );
}

export interface DuplicateFlagResult {
  candidate_id: string;
  flag_type: "duplicate_content" | "recycled_appeal";
  similarity_score: number;
  similarity_reason: string;
  recommended_action: string;
}

// Tool Use（Structured Outputs）用スキーマ。理由は extract-page.ts 参照。
export const DETECT_DUPLICATES_TOOL = {
  name: "submit_duplicate_flags",
  description: "重複・類似記事の検出結果を送信する",
  input_schema: {
    type: "object",
    required: ["flags"],
    properties: {
      flags: {
        type: "array",
        items: {
          type: "object",
          required: [
            "candidate_id",
            "flag_type",
            "similarity_score",
            "similarity_reason",
            "recommended_action",
          ],
          properties: {
            candidate_id: { type: "string" },
            flag_type: { type: "string", enum: ["duplicate_content", "recycled_appeal"] },
            similarity_score: { type: "number" },
            similarity_reason: { type: "string" },
            recommended_action: { type: "string" },
          },
        },
      },
    },
  },
} as const;
