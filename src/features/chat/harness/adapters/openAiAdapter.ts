/**
 * OpenAI adapter with function calling / tool use support.
 */

import { type AgentTool, type ToolCall } from "../types";

export interface OpenAiExecutionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      role: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
}

export interface OpenAiCallResult {
  text: string;
  toolCalls: ToolCall[];
  rawMessage: any;
}

export const callOpenAiApi = async (params: {
  apiKey: string;
  model: string;
  messages: OpenAiExecutionMessage[];
  tools?: AgentTool[];
  maxTokens?: number;
}): Promise<OpenAiCallResult> => {
  const openAiTools = params.tools?.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const payload: Record<string, any> = {
    model: params.model,
    messages: params.messages,
    max_completion_tokens: params.maxTokens ?? 2048,
  };

  if (openAiTools && openAiTools.length > 0) {
    payload.tools = openAiTools;
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorBody = await resp.text();
    throw new Error(`OpenAI error (${resp.status}): ${errorBody}`);
  }

  const data = (await resp.json()) as OpenAiChatCompletionResponse;
  const anyData = data as any;
  const legacyContent = anyData?.output?.find?.(
    (i: any) => i.type === "message",
  )?.content?.[0]?.text;
  const choice = data.choices?.[0];
  const message = choice?.message;

  const rawToolCalls = message?.tool_calls ?? [];
  const parsedToolCalls: ToolCall[] = [];

  for (const call of rawToolCalls) {
    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(call.function.arguments || "{}");
    } catch {
      parsedArgs = { raw: call.function.arguments };
    }

    parsedToolCalls.push({
      id: call.id,
      name: call.function.name,
      arguments: parsedArgs,
    });
  }

  return {
    text: message?.content ?? legacyContent ?? "",
    toolCalls: parsedToolCalls,
    rawMessage: message ?? anyData,
  };
};
