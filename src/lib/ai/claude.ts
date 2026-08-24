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
