/**
 * Anthropic Claude adapter with native Tool Use support.
 */

import { type AgentTool, type ToolCall } from "../types";

export interface AnthropicExecutionTurn {
  role: "user" | "assistant";
  content: unknown;
}

export interface AnthropicResponsePayload {
  content?: Array<{
    type: "text" | "tool_use";
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
  }>;
  stop_reason?: string;
}

export interface AnthropicCallResult {
  text: string;
  toolCalls: ToolCall[];
  rawContent: unknown;
}

export const callAnthropicApi = async (params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: AnthropicExecutionTurn[];
  tools?: AgentTool[];
  maxTokens?: number;
}): Promise<AnthropicCallResult> => {
  const anthropicTools = params.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));

  const payload: Record<string, any> = {
    model: params.model,
    system: params.systemPrompt,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 2048,
  };

  if (anthropicTools && anthropicTools.length > 0) {
    payload.tools = anthropicTools;
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorBody = await resp.text();
    throw new Error(`Anthropic error (${resp.status}): ${errorBody}`);
  }

  const data = (await resp.json()) as AnthropicResponsePayload;
  const contentBlocks = data.content ?? [];

  const textBlocks = contentBlocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string);

  const toolUseBlocks = contentBlocks.filter(
    (b) =>
      b.type === "tool_use" &&
      typeof b.id === "string" &&
      typeof b.name === "string",
  );

  const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
    id: b.id!,
    name: b.name!,
    arguments: b.input ?? {},
  }));

  return {
    text: textBlocks.join("\n\n").trim(),
    toolCalls,
    rawContent: contentBlocks,
  };
};
