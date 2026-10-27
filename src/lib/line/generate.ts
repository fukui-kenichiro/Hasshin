import { callClaudeTool } from "@/lib/ai/claude";
import {
  LINE_MESSAGE_SYSTEM_PROMPT,
  LINE_MESSAGE_TOOL,
  buildLineMessageUserPrompt,
  type LineMessageInput,
  type LineMessageResult,
} from "@/lib/ai/prompts/line-message";

export async function generateLineMessage(input: LineMessageInput): Promise<{ messageText: string; notes: string[] }> {
  const result = await callClaudeTool<LineMessageResult>(
    LINE_MESSAGE_SYSTEM_PROMPT,
    buildLineMessageUserPrompt(input),
    LINE_MESSAGE_TOOL
  );
  return { messageText: result.message_text.trim(), notes: result.notes ?? [] };
}
