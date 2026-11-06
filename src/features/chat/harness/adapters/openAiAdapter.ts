/**
 * OpenAI adapter with function calling / tool use support.
 */

import { type AgentTool, type ToolCall, type TokenUsage } from "../types";

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
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
  output?: Array<{
    type?: string;
    content?: Array<{
      text?: string;
    }>;
  }>;
}

export interface OpenAiCallResult {
  text: string;
  toolCalls: ToolCall[];
  rawMessage: OpenAiExecutionMessage;
  usage?: TokenUsage;
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

  const payload: Record<string, unknown> = {
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
  const legacyContent = data.output?.find((i) => i.type === "message")
    ?.content?.[0]?.text;
  const choice = data.choices?.[0];
  const message = choice?.message;

  const rawToolCalls = message?.tool_calls ?? [];
  const parsedToolCalls: ToolCall[] = [];

  for (const call of rawToolCalls) {
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(call.function.arguments || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      parsedArgs = { raw: call.function.arguments };
    }

    parsedToolCalls.push({
      id: call.id,
      name: call.function.name,
      arguments: parsedArgs,
    });
  }

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const totalTokens =
    data.usage?.total_tokens ?? promptTokens + completionTokens;
  const cachedTokens = data.usage?.prompt_tokens_details?.cached_tokens;
  const usage: TokenUsage | undefined = data.usage
    ? {
        promptTokens,
        completionTokens,
        totalTokens,
        ...(cachedTokens !== undefined ? { cachedTokens } : {}),
      }
    : undefined;

  return {
    text: message?.content ?? legacyContent ?? "",
    toolCalls: parsedToolCalls,
    rawMessage: (message ?? {
      role: "assistant",
      content: "",
    }) as OpenAiExecutionMessage,
    usage,
  };
};
