/**
 * Main Harness Orchestrator for WebIridium Agent.
 * Coordinates dynamic prompt assembly, multi-provider dispatch, multi-turn tool execution loop,
 * and human-in-the-loop action confirmation.
 */

import { getDefaultStore } from "jotai";
import {
  type AgentTool,
  type ExecutedToolRecord,
  type HarnessResponse,
  type HarnessProgressUpdate,
  type ConfirmationRequest,
  type ToolContext,
  type AgentTurnDebug,
} from "./types";
import { simulationTools } from "./tools/simulationTools";
import {
  assembleAgentSystemPrompt,
  type PromptAssemblyOptions,
} from "./context/promptAssembler";
import { formatCurrentApplicationState } from "./context/stateSnapshot";
import {
  callAnthropicApi,
  type AnthropicExecutionTurn,
} from "./adapters/anthropicAdapter";
import {
  callOpenAiApi,
  type OpenAiExecutionMessage,
} from "./adapters/openAiAdapter";
import { AVAILABLE_MODELS } from "@/globals/chat";

export interface OrchestratorParams {
  model: string;
  openAiApiKey?: string | null;
  claudeApiKey?: string | null;
  messages: Array<{ role: "user" | "llm"; text: string }>;
  promptOptions?: PromptAssemblyOptions;
  tools?: AgentTool[];
  context?: ToolContext;
  maxTurns?: number;
  requireConfirmation?: boolean;
  onProgress?: (progress: HarnessProgressUpdate) => void;
  onConfirmAction?: (request: ConfirmationRequest) => Promise<boolean>;
}

export const getJotaiToolContext = (customStore?: ReturnType<typeof getDefaultStore>): ToolContext => {
  const store = customStore ?? getDefaultStore();
  return {
    get: (atom) => store.get(atom),
    set: (atom, ...args) => store.set(atom, ...args),
  };
};

export const executeHarnessTurn = async (
  params: OrchestratorParams,
): Promise<HarnessResponse> => {
  const startTime = Date.now();
  const context = params.context ?? getJotaiToolContext();
  const tools = params.tools ?? simulationTools;

  // Determine provider from model definition
  const modelConfig = AVAILABLE_MODELS.find((m) => m.id === params.model);
  const isClaude =
    modelConfig?.provider === "anthropic" ||
    params.model.toLowerCase().includes("claude");

  // Assemble dynamic contextual system prompt
  const systemPrompt = assembleAgentSystemPrompt(context, params.promptOptions);
  const executedTools: ExecutedToolRecord[] = [];
  const maxTurns = params.maxTurns ?? 5;

  if (isClaude) {
    if (!params.claudeApiKey) {
      throw new Error(
        "Anthropic API key is missing. Please set it in Settings.",
      );
    }

    // Format conversation history for Anthropic
    const anthropicMessages: AnthropicExecutionTurn[] = params.messages.map(
      (m) => ({
        role: m.role === "llm" ? "assistant" : "user",
        content: m.text,
      }),
    );

    // Attach verified ground-truth live workbench state to the latest user request turn
    let lastAnthropicUserIdx = -1;
    for (let i = anthropicMessages.length - 1; i >= 0; i--) {
      if (anthropicMessages[i].role === "user") {
        lastAnthropicUserIdx = i;
        break;
      }
    }
    if (lastAnthropicUserIdx !== -1) {
      const liveState = formatCurrentApplicationState(context);
      anthropicMessages[lastAnthropicUserIdx] = {
        ...anthropicMessages[lastAnthropicUserIdx],
        content: `${String(anthropicMessages[lastAnthropicUserIdx].content)}\n\n[LIVE APPLICATION STATE AT TIME OF REQUEST]:\n${liveState}`,
      };
    }

    let currentMessages: AnthropicExecutionTurn[] = [...anthropicMessages];
    const turnDebugs: AgentTurnDebug[] = [];
    let turnCount = 0;
    let stepCount = 0;
    let finalReply = "";

    while (turnCount < maxTurns) {
      turnCount++;
      params.onProgress?.({
        status: turnCount === 1 ? "thinking" : "synthesizing",
        message:
          turnCount === 1
            ? "Analyzing request..."
            : `Evaluating results & planning next step (Round ${turnCount})...`,
        turn: turnCount,
      });

      const turn = await callAnthropicApi({
        apiKey: params.claudeApiKey,
        model: params.model,
        systemPrompt,
        messages: currentMessages,
        tools,
      });

      if (turn.toolCalls.length === 0) {
        finalReply = turn.text || finalReply || "(no response)";
        turnDebugs.push({
          turn: turnCount,
          modelResponse: {
            text: turn.text,
            toolCalls: [],
          },
          toolExecutions: [],
        });
        break;
      }

      // Execute requested tools
      const turnExecutedTools: ExecutedToolRecord[] = [];
      const toolResultsContent: any[] = [];
      for (const call of turn.toolCalls) {
        stepCount++;
        const toolDef = tools.find((t) => t.name === call.name);

        if (toolDef) {
          // Check if action requires user confirmation
          const shouldConfirm =
            params.requireConfirmation !== false &&
            toolDef.mutatesState &&
            Boolean(params.onConfirmAction);

          if (shouldConfirm && params.onConfirmAction) {
            const changeDetails = toolDef.describeChanges
              ? toolDef.describeChanges(call.arguments, context)
              : undefined;

            const actionDescription =
              changeDetails?.summary ||
              (toolDef.describeAction
                ? toolDef.describeAction(call.arguments, context)
                : `Execute ${call.name}`);

            params.onProgress?.({
              status: "confirming",
              message: `Awaiting user commitment: ${actionDescription}`,
              turn: turnCount,
              step: stepCount,
              toolName: call.name,
              arguments: call.arguments,
            });

            const revertData = toolDef.getRevertData
              ? toolDef.getRevertData(call.arguments, context)
              : undefined;

            const approved = await params.onConfirmAction({
              id: call.id,
              toolName: call.name,
              arguments: call.arguments,
              description: actionDescription,
              changes: changeDetails?.changes,
              consequences: changeDetails?.consequences,
              revertData,
            });

            if (!approved) {
              const declineResult = {
                success: false,
                message: `User declined permission to execute '${call.name}': ${actionDescription}.`,
                error: "USER_DECLINED_ACTION",
              };
              const record: ExecutedToolRecord = {
                id: call.id,
                name: call.name,
                arguments: call.arguments,
                result: declineResult,
                turn: turnCount,
                step: stepCount,
              };
              executedTools.push(record);
              turnExecutedTools.push(record);
              toolResultsContent.push({
                type: "tool_result",
                tool_use_id: call.id,
                content: JSON.stringify(declineResult),
              });
              continue;
            }
          }

          params.onProgress?.({
            status: "executing_tool",
            message: `Executing action ${stepCount}: ${call.name}...`,
            turn: turnCount,
            step: stepCount,
            toolName: call.name,
            arguments: call.arguments,
          });

          try {
            const result = await toolDef.execute(call.arguments, context);
            if (toolDef.mutatesState && result && typeof result === "object") {
              result.verifiedPostActionState =
                formatCurrentApplicationState(context);
            }
            const record: ExecutedToolRecord = {
              id: call.id,
              name: call.name,
              arguments: call.arguments,
              result,
              turn: turnCount,
              step: stepCount,
            };
            executedTools.push(record);
            turnExecutedTools.push(record);
            toolResultsContent.push({
              type: "tool_result",
              tool_use_id: call.id,
              content: JSON.stringify(result),
            });
          } catch (err: unknown) {
            const errorResult = {
              success: false,
              message: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
              error: String(err),
            };
            const record: ExecutedToolRecord = {
              id: call.id,
              name: call.name,
              arguments: call.arguments,
              result: errorResult,
              turn: turnCount,
              step: stepCount,
            };
            executedTools.push(record);
            turnExecutedTools.push(record);
            toolResultsContent.push({
              type: "tool_result",
              tool_use_id: call.id,
              content: JSON.stringify(errorResult),
              is_error: true,
            });
          }
        }
      }

      turnDebugs.push({
        turn: turnCount,
        modelResponse: {
          text: turn.text,
          toolCalls: turn.toolCalls,
        },
        toolExecutions: turnExecutedTools,
      });

      // Feed tool observation back to Claude for the next turn
      currentMessages = [
        ...currentMessages,
        {
          role: "assistant",
          content: turn.rawContent,
        },
        {
          role: "user",
          content: toolResultsContent,
        },
      ];

      if (turn.text) {
        finalReply = turn.text;
      }
    }

    return {
      reply:
        finalReply ||
        (executedTools.length > 0
          ? "Actions executed successfully."
          : "(no response)"),
      executedTools,
      debugInfo: {
        provider: "anthropic",
        model: params.model,
        systemPrompt,
        initialMessages: params.messages,
        totalTurns: turnCount,
        totalSteps: stepCount,
        durationMs: Date.now() - startTime,
        turns: turnDebugs,
      },
    };
  } else {
    // OpenAI Provider
    if (!params.openAiApiKey) {
      throw new Error("OpenAI API key is missing. Please set it in Settings.");
    }

    // Format conversation history for OpenAI
    const openAiMessages: OpenAiExecutionMessage[] = [
      { role: "system", content: systemPrompt },
      ...params.messages.map(
        (m) =>
          ({
            role: m.role === "llm" ? "assistant" : "user",
            content: m.text,
          }) as OpenAiExecutionMessage,
      ),
    ];

    // Attach verified ground-truth live workbench state to the latest user request turn
    let lastOpenAiUserIdx = -1;
    for (let i = openAiMessages.length - 1; i >= 0; i--) {
      if (openAiMessages[i].role === "user") {
        lastOpenAiUserIdx = i;
        break;
      }
    }
    if (lastOpenAiUserIdx !== -1) {
      const liveState = formatCurrentApplicationState(context);
      openAiMessages[lastOpenAiUserIdx] = {
        ...openAiMessages[lastOpenAiUserIdx],
        content: `${openAiMessages[lastOpenAiUserIdx].content}\n\n[LIVE APPLICATION STATE AT TIME OF REQUEST]:\n${liveState}`,
      };
    }

    let currentMessages: OpenAiExecutionMessage[] = [...openAiMessages];
    const turnDebugs: AgentTurnDebug[] = [];
    let turnCount = 0;
    let stepCount = 0;
    let finalReply = "";

    while (turnCount < maxTurns) {
      turnCount++;
      params.onProgress?.({
        status: turnCount === 1 ? "thinking" : "synthesizing",
        message:
          turnCount === 1
            ? "Analyzing request..."
            : `Evaluating results & planning next step (Round ${turnCount})...`,
        turn: turnCount,
      });

      const turn = await callOpenAiApi({
        apiKey: params.openAiApiKey,
        model: params.model,
        messages: currentMessages,
        tools,
      });

      if (turn.toolCalls.length === 0) {
        finalReply = turn.text || finalReply || "(no response)";
        turnDebugs.push({
          turn: turnCount,
          modelResponse: {
            text: turn.text,
            toolCalls: [],
          },
          toolExecutions: [],
        });
        break;
      }

      // Execute requested tools
      const turnExecutedTools: ExecutedToolRecord[] = [];
      const toolResultMessages: OpenAiExecutionMessage[] = [];
      for (const call of turn.toolCalls) {
        stepCount++;
        const toolDef = tools.find((t) => t.name === call.name);

        if (toolDef) {
          // Check if action requires user confirmation
          const shouldConfirm =
            params.requireConfirmation !== false &&
            toolDef.mutatesState &&
            Boolean(params.onConfirmAction);

          if (shouldConfirm && params.onConfirmAction) {
            const changeDetails = toolDef.describeChanges
              ? toolDef.describeChanges(call.arguments, context)
              : undefined;

            const actionDescription =
              changeDetails?.summary ||
              (toolDef.describeAction
                ? toolDef.describeAction(call.arguments, context)
                : `Execute ${call.name}`);

            params.onProgress?.({
              status: "confirming",
              message: `Awaiting user commitment: ${actionDescription}`,
              turn: turnCount,
              step: stepCount,
              toolName: call.name,
              arguments: call.arguments,
            });

            const revertData = toolDef.getRevertData
              ? toolDef.getRevertData(call.arguments, context)
              : undefined;

            const approved = await params.onConfirmAction({
              id: call.id,
              toolName: call.name,
              arguments: call.arguments,
              description: actionDescription,
              changes: changeDetails?.changes,
              consequences: changeDetails?.consequences,
              revertData,
            });

            if (!approved) {
              const declineResult = {
                success: false,
                message: `User declined permission to execute '${call.name}': ${actionDescription}.`,
                error: "USER_DECLINED_ACTION",
              };
              const record: ExecutedToolRecord = {
                id: call.id,
                name: call.name,
                arguments: call.arguments,
                result: declineResult,
                turn: turnCount,
                step: stepCount,
              };
              executedTools.push(record);
              turnExecutedTools.push(record);
              toolResultMessages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(declineResult),
              });
              continue;
            }
          }

          params.onProgress?.({
            status: "executing_tool",
            message: `Executing action ${stepCount}: ${call.name}...`,
            turn: turnCount,
            step: stepCount,
            toolName: call.name,
            arguments: call.arguments,
          });

          try {
            const result = await toolDef.execute(call.arguments, context);
            if (toolDef.mutatesState && result && typeof result === "object") {
              result.verifiedPostActionState =
                formatCurrentApplicationState(context);
            }
            const record: ExecutedToolRecord = {
              id: call.id,
              name: call.name,
              arguments: call.arguments,
              result,
              turn: turnCount,
              step: stepCount,
            };
            executedTools.push(record);
            turnExecutedTools.push(record);
            toolResultMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          } catch (err: unknown) {
            const errorResult = {
              success: false,
              message: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
              error: String(err),
            };
            const record: ExecutedToolRecord = {
              id: call.id,
              name: call.name,
              arguments: call.arguments,
              result: errorResult,
              turn: turnCount,
              step: stepCount,
            };
            executedTools.push(record);
            turnExecutedTools.push(record);
            toolResultMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(errorResult),
            });
          }
        }
      }

      turnDebugs.push({
        turn: turnCount,
        modelResponse: {
          text: turn.text,
          toolCalls: turn.toolCalls,
        },
        toolExecutions: turnExecutedTools,
      });

      currentMessages = [
        ...currentMessages,
        turn.rawMessage,
        ...toolResultMessages,
      ];

      if (turn.text) {
        finalReply = turn.text;
      }
    }

    return {
      reply:
        finalReply ||
        (executedTools.length > 0
          ? "Actions executed successfully."
          : "(no response)"),
      executedTools,
      debugInfo: {
        provider: "openai",
        model: params.model,
        systemPrompt,
        initialMessages: params.messages,
        totalTurns: turnCount,
        totalSteps: stepCount,
        durationMs: Date.now() - startTime,
        turns: turnDebugs,
      },
    };
  }
};
