// processing_jobs の job_type = 'extract_page' で使うプロンプト。
// 1ページの画像を渡し、見出し／本文／画像領域／マストヘッド情報を
// 構造化されたJSONとして抽出させる。PDFのテキストレイヤーは使わない
// （文字順が破損することを確認済みのため）。

export const EXTRACT_PAGE_SYSTEM_PROMPT = `あなたは日本語の組織内ニュースレター（政党の地区委員会・市委員会が発行する活動ニュース）のページ画像を読み取り、レイアウトを構造化データに変換するアシスタントです。

このニュースレターは「北多摩東部地区推進ニュース」または「がんばるニュース（小平市委員会）」のいずれかで、B5/A4の1〜2段組みレイアウトです。あなたの仕事は、後続の編集支援システムが記事単位に分割・リライトできるよう、ページ内の要素を読む順序に沿って構造化して書き出すことです。リライトや要約、内容の評価は行わず、書かれている通りに忠実に書き起こしてください。

必ず以下のJSONスキーマで出力してください（説明文は不要、JSONのみ）：

{
  "page_number": number,
  "masthead": {
    "publication_name": string,       // 例: "党活動推進ニュース", "がんばるニュース"
    "issuer": string | null,           // 例: "北多摩東部地区委員会", "日本共産党小平市委員会"
    "issue_label": string | null,      // 号数・日付表記。ページに書かれている通り
    "internal_marker_text": string | null  // "部内資料" 等、内部限定を示す明記があればその文言そのまま。なければ null
  } | null,   // このページにマストヘッド（紙面タイトル部分）がなければ null
  "blocks": [
    {
      "id": string,                   // "p{page_number}-b{連番}" 形式
      "type": "headline" | "subheading" | "body" | "caption" | "boxed_notice" | "byline" | "image",
      "text": string | null,          // image タイプの場合は撮影内容の客観的description、それ以外は書き起こしたテキスト
      "reading_order": number,        // ページ内での読む順序（1始まり）
      "column": "left" | "right" | "full" | null,
      "contains_internal_marker": boolean,  // このブロック本文中に「部内資料」「党員限定」「〇〇支部長は…」等、内部限定・内部連絡事項を示す記述が含まれるか
      "internal_marker_note": string | null // contains_internal_marker が true の場合、該当箇所を短く引用
    }
  ]
}

注意点：
- 見出し（headline/subheading）と本文（body）は分けること。装飾的な囲み記事（boxed_notice、例:「7/18 党創立記念講演視聴会を開催します」のような案内ボックス）も区別すること。
- 写真・図版は type: "image" とし、text にはキャプションではなく写真の内容の客観的な説明を入れる。キャプション文がある場合は別途 type: "caption" のブロックとして起こす。
- 2段組みの場合、読む順序は「左段を上から下、続いて右段を上から下」が基本だが、実際のレイアウト（見出しが2段にまたがる等）に従うこと。
- contains_internal_marker は文単位で厳密に判定する。「部内資料」という明記、支部長・地区委員長など特定の役職者への具体的な内部指示、党員数・読者数・得票率・入党目標人数など内部限定の具体的数値が含まれる場合に true とする。単に政治的な主張が書かれているだけでは true にしない。
- 読み取れない文字は "�" ではなく、文脈から最も可能性の高い文字を補って構わないが、確信が持てない場合は "[判読不能]" と記載する。`;

export function buildExtractPageUserPrompt(pageNumber: number): string {
  return `これはニュースレターの ${pageNumber} ページ目の画像です。上記スキーマに従ってJSONのみを出力してください。`;
}

// Claude の Tool Use（Structured Outputs）で使うスキーマ。
// テキスト応答からJSONを正規表現で抜き出してパースする方式は、本文が長い・
// 改行や引用符を含む記事で無効なJSONを生成することがあり
// （実際に「推進ニュース2025.10.21.pdf」で発生）、Tool Use に切り替えて
// APIレベルでスキーマに沿ったJSONを保証させる。
export const EXTRACT_PAGE_TOOL = {
  name: "submit_extracted_page",
  description: "1ページ分の構造化抽出結果を送信する",
  input_schema: {
    type: "object",
    required: ["page_number", "masthead", "blocks"],
    properties: {
      page_number: { type: "integer" },
      masthead: {
        type: ["object", "null"],
        required: ["publication_name", "issuer", "issue_label", "internal_marker_text"],
        properties: {
          publication_name: { type: "string" },
          issuer: { type: ["string", "null"] },
          issue_label: { type: ["string", "null"] },
          internal_marker_text: { type: ["string", "null"] },
        },
      },
      blocks: {
        type: "array",
        items: {
          type: "object",
          required: [
            "id",
            "type",
            "text",
            "reading_order",
            "column",
            "contains_internal_marker",
            "internal_marker_note",
          ],
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: ["headline", "subheading", "body", "caption", "boxed_notice", "byline", "image"],
            },
            text: { type: ["string", "null"] },
            reading_order: { type: "integer" },
            column: { type: ["string", "null"], enum: ["left", "right", "full", null] },
            contains_internal_marker: { type: "boolean" },
            internal_marker_note: { type: ["string", "null"] },
          },
        },
      },
    },
  },
} as const;

export interface ExtractedBlock {
  id: string;
  type:
    | "headline"
    | "subheading"
    | "body"
    | "caption"
    | "boxed_notice"
    | "byline"
    | "image";
  text: string | null;
  reading_order: number;
  column: "left" | "right" | "full" | null;
  contains_internal_marker: boolean;
  internal_marker_note: string | null;
}

export interface ExtractedPage {
  page_number: number;
  masthead: {
    publication_name: string;
    issuer: string | null;
    issue_label: string | null;
    internal_marker_text: string | null;
  } | null;
  blocks: ExtractedBlock[];
}
