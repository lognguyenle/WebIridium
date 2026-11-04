/**
 * Core type definitions for the WebIridium Agent Harness.
 */

import { type Atom, type WritableAtom } from "jotai";

export interface ToolContext {
  get: <Value>(atom: Atom<Value>) => Value;
  set: <Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    ...args: Args
  ) => Result;
}

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[] | number[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface ToolParametersSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParametersSchema;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  verifiedPostActionState?: string;
}

export interface StateChangeItem {
  field: string;
  currentValue: string;
  proposedValue: string;
}

export interface ChangeReviewDetails {
  summary: string;
  changes: StateChangeItem[];
  consequences?: string[];
}

export interface ConfirmationRequest {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  description: string;
  changes?: StateChangeItem[];
  consequences?: string[];
  revertData?: Record<string, any>;
}

export interface CommittedActionRecord {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  description: string;
  changes?: StateChangeItem[];
  consequences?: string[];
  status: "committed" | "discarded" | "reverted";
  timestamp: number;
  revertData?: Record<string, any>;
}

export interface AgentTool extends ToolDefinition {
  execute: (
    args: Record<string, any>,
    context: ToolContext,
  ) => Promise<ToolExecutionResult> | ToolExecutionResult;
  mutatesState?: boolean;
  describeAction?: (args: Record<string, any>, context: ToolContext) => string;
  describeChanges?: (
    args: Record<string, any>,
    context: ToolContext,
  ) => ChangeReviewDetails;
  getRevertData?: (
    args: Record<string, any>,
    context: ToolContext,
  ) => Record<string, any>;
  revert?: (
    revertData: Record<string, any>,
    context: ToolContext,
  ) => Promise<ToolExecutionResult> | ToolExecutionResult;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ExecutedToolRecord {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result: ToolExecutionResult;
  turn?: number;
  step?: number;
  description?: string;
  changes?: StateChangeItem[];
  consequences?: string[];
  revertData?: Record<string, any>;
}

export interface HarnessProgressUpdate {
  status: "thinking" | "executing_tool" | "confirming" | "synthesizing";
  message: string;
  turn: number;
  step?: number;
  toolName?: string;
  arguments?: Record<string, any>;
}

export interface HarnessMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface HarnessRequest {
  model: string;
  apiKey: string;
  messages: Array<{ role: "user" | "llm"; text: string }>;
  systemPrompt: string;
  tools?: AgentTool[];
}

export interface AgentTurnDebug {
  turn: number;
  modelResponse: {
    text?: string;
    toolCalls: ToolCall[];
  };
  toolExecutions: ExecutedToolRecord[];
}

export interface AgentDebugInfo {
  provider: "anthropic" | "openai";
  model: string;
  systemPrompt: string;
  initialMessages: Array<{ role: "user" | "llm"; text: string }>;
  totalTurns: number;
  totalSteps: number;
  durationMs?: number;
  turns: AgentTurnDebug[];
}

export interface HarnessResponse {
  reply: string;
  executedTools: ExecutedToolRecord[];
  debugInfo?: AgentDebugInfo;
}
