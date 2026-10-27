import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY が設定されていません。.env.local に設定してください。"
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Vision抽出・記事構造化・地域タグ付け・リライト・重複検出のすべてで
// 同じモデルを使う想定。精度とコストのバランスは実サンプルでの検証結果を見て調整する。
export const EXTRACTION_MODEL = "claude-sonnet-4-5";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; [key: string]: unknown };
}

export async function callClaudeTool<T>(system: string, userContent: unknown, tool: ToolDef): Promise<T> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: EXTRACTION_MODEL,
    // 内容量の多いPDF（本文が長い記事や複数記事の一括グルーピング等）で
    // 4096だと出力が途中で切れ、結果として必須フィールド（例: articles）が
    // 欠けた不完全なJSONになり、呼び出し側で「is not iterable」等の
    // わかりにくいエラーになる事例が実際に発生したため引き上げた。
    max_tokens: 8192,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: userContent as any }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `「${tool.name}」の出力が長さ制限に達し、途中で切れました。内容量が多い入力の可能性があります。`
    );
  }

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`「${tool.name}」の構造化出力が得られませんでした`);
  }
  return toolUse.input as T;
}
