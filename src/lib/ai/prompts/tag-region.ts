// processing_jobs の job_type = 'tag_region' で使うプロンプト。
//
// 実装上の前提（コード側で分岐、AIを呼ばない部分）:
// - source_type === 'ganbaru_news' の記事は常に region_tag = 'kodaira' で確定する
//   （小平市委員会発行のため）。このプロンプトは呼び出さない。
// - このプロンプトは source_type === 'suishin_news'（北多摩東部地区推進ニュース）
//   の記事にのみ使う。
//
// 北多摩東部地区推進ニュースの記事は、まず「北多摩東部HP向けの記事」として
// ベースの region_tag を決める（多くの場合 kitatama_tobu）。そのうえで、
// 西東京市に特化した内容であれば、西東京HP向けの派生記事を追加で作るべきかを
// 判定する（ユーザー確認済み: デフォルトは両方に掲載、西東京向けは別途書き直し。
// 手動調整可）。派生記事の実際の生成（articles テーブルへの2行目のinsertと
// rewriteジョブの追加投入）はアプリケーション側の責務で、このプロンプトは
// 判定のみを行う。
//
// 実サンプル（推進ニュース2026.07.27.pdf「7.25西東京トークライブ」記事）で
// 検証済み: 西東京市議選予定候補の紹介・西東京市内での演説会報告は、
// 北多摩東部HP（地区全体の活動報告として）・西東京HP（西東京に特化した記事として）
// の両方に妥当性があることを確認した。
//
// 【ユーザーフィードバックによる修正】当初は "undetermined"（判定不能）を選択肢に
// 含めていたが、実際に運用したところ、国政・都全体の会議など特定の市に
// 紐づかない話題で頻発し、「判定不能」の記事が多く出てしまった。ユーザーの指示
// 「どれにも当てはまらない場合は一旦『北多摩東部』に振り分けてください」を受け、
// base_region_tag から undetermined を廃止し、該当する場合は kitatama_tobu を
// 選ぶよう変更した（スキーマ自体から選択肢を削除し、AIが選べないようにした）。
// 内容の公開可否そのものへの疑問は region_tag ではなく assemble_articles の
// public_suitability（rewrite_candidate/needs_human_judgment等）が担う。

export const TAG_REGION_SYSTEM_PROMPT = `あなたは「北多摩東部地区推進ニュース」の記事を読み、掲載先サイトの地域タグを判定するアシスタントです。北多摩東部地区委員会は複数の市（西東京市を含む）を管轄しており、このニュースは地区全体向けに発行されています。

必ず以下のJSONスキーマで出力してください（説明文は不要、JSONのみ）：

{
  "base_region_tag": "kitatama_tobu" | "multiple",
  "base_confidence": number,          // 0.0〜1.0
  "base_reasoning": string,
  "nishitokyo_derivative_recommended": boolean,
  "nishitokyo_derivative_confidence": number | null,   // recommended が true の場合のみ
  "nishitokyo_derivative_reasoning": string | null
}

base_region_tag の判定基準：
- "kitatama_tobu": 特定の1市に限定されない話題、地区としての活動報告、国政・都全体の会議など**どの市にも明確に紐づかない話題**を含め、基本はすべてこれにする（デフォルト）。特定の1市（西東京市等）に特化した内容であっても、地区活動の一環として報告する価値があれば kitatama_tobu とし、別途 nishitokyo_derivative で対応する
- "multiple": 複数の市の話題が明確に並記されており、地区全体の話題ともいえない場合のみ使う

判断に迷う場合や、どの市にも紐づかない話題（国政・外交・都全体の会議等）の場合は、必ず "kitatama_tobu" にすること。地域が分からないからといって判定を保留にしない。掲載してよい内容かどうかの疑問は、この判定とは別の工程（記事全体の公開可否判定）で扱われるので、ここでは地域タグを決めることだけに専念する。

nishitokyo_derivative_recommended の判定基準：
- 記事の主題が西東京市に明確に特化している場合（例: 西東京市議選の候補者紹介、西東京市内で開催されたイベントの報告、西東京市議会に関する話題）に true とする
- 地区全体に関する一般的な話題（国政情勢の論評、党大会に向けた方針等）では false とする
- true の場合、nishitokyo_derivative_reasoning に該当箇所を根拠として示すこと`;

export function buildTagRegionUserPrompt(title: string, bodyText: string): string {
  return `タイトル: ${title}\n\n本文:\n${bodyText}`;
}

// Tool Use（Structured Outputs）用スキーマ。理由は extract-page.ts 参照。
export const TAG_REGION_TOOL = {
  name: "submit_region_tag",
  description: "地域タグの判定結果を送信する",
  input_schema: {
    type: "object",
    required: [
      "base_region_tag",
      "base_confidence",
      "base_reasoning",
      "nishitokyo_derivative_recommended",
      "nishitokyo_derivative_confidence",
      "nishitokyo_derivative_reasoning",
    ],
    properties: {
      base_region_tag: { type: "string", enum: ["kitatama_tobu", "multiple"] },
      base_confidence: { type: "number" },
      base_reasoning: { type: "string" },
      nishitokyo_derivative_recommended: { type: "boolean" },
      nishitokyo_derivative_confidence: { type: ["number", "null"] },
      nishitokyo_derivative_reasoning: { type: ["string", "null"] },
    },
  },
} as const;

export interface TagRegionResult {
  base_region_tag: "kitatama_tobu" | "multiple";
  base_confidence: number;
  base_reasoning: string;
  nishitokyo_derivative_recommended: boolean;
  nishitokyo_derivative_confidence: number | null;
  nishitokyo_derivative_reasoning: string | null;
}
