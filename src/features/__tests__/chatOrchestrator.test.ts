import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeHarnessTurn } from "../chat/harness/orchestrator";
import {
  type AgentTool,
  type ToolContext,
  type HarnessProgressUpdate,
} from "../chat/harness/types";

vi.mock("@/globals/chat", () => ({
  AVAILABLE_MODELS: [
    { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "openai" },
    {
      id: "claude-sonnet-4-6",
      name: "Claude 4.6 Sonnet",
      provider: "anthropic",
    },
  ],
  DEFAULT_SYSTEM_PROMPT: "Default prompt",
  MASTER_PROMPT: "Master prompt",
}));

describe("executeHarnessTurn multi-turn action orchestration", () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      get: vi.fn(),
      set: vi.fn(),
    };
    vi.restoreAllMocks();
  });

  it("handles multi-turn tool calling across consecutive rounds with OpenAI", async () => {
    const executedSteps: string[] = [];
    const dummyToolA: AgentTool = {
      name: "tool_alpha",
      description: "First tool",
      parameters: { type: "object", properties: {} },
      execute: vi.fn().mockImplementation(() => {
        executedSteps.push("tool_alpha");
        return { success: true, message: "Alpha executed successfully" };
      }),
    };

    const dummyToolB: AgentTool = {
      name: "tool_beta",
      description: "Second tool",
      parameters: { type: "object", properties: {} },
      execute: vi.fn().mockImplementation(() => {
        executedSteps.push("tool_beta");
        return { success: true, message: "Beta executed successfully" };
      }),
    };

    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // Round 1: Model calls tool_alpha
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: { name: "tool_alpha", arguments: "{}" },
                      },
                    ],
                  },
                },
              ],
            }),
        });
      } else if (fetchCallCount === 2) {
        // Round 2: Model calls tool_beta
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call_2",
                        type: "function",
                        function: { name: "tool_beta", arguments: "{}" },
                      },
                    ],
                  },
                },
              ],
            }),
        });
      } else {
        // Round 3: Model finishes with explanation
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "Completed both Alpha and Beta actions.",
                  },
                },
              ],
            }),
        });
      }
    });

    const progressUpdates: HarnessProgressUpdate[] = [];

    const result = await executeHarnessTurn({
      model: "gpt-5.4-mini",
      openAiApiKey: "test-openai-key",
      messages: [{ role: "user", text: "Run alpha then beta" }],
      tools: [dummyToolA, dummyToolB],
      context: mockContext,
      onProgress: (update) => progressUpdates.push(update),
    });

    expect(result.reply).toBe("Completed both Alpha and Beta actions.");
    expect(result.executedTools).toHaveLength(2);

    expect(result.executedTools[0].name).toBe("tool_alpha");
    expect(result.executedTools[0].turn).toBe(1);
    expect(result.executedTools[0].step).toBe(1);

    expect(result.executedTools[1].name).toBe("tool_beta");
    expect(result.executedTools[1].turn).toBe(2);
    expect(result.executedTools[1].step).toBe(2);

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo?.provider).toBe("openai");
    expect(result.debugInfo?.model).toBe("gpt-5.4-mini");
    expect(result.debugInfo?.totalTurns).toBe(3);
    expect(result.debugInfo?.totalSteps).toBe(2);
    expect(result.debugInfo?.turns).toHaveLength(3);
    expect(result.debugInfo?.turns[0].modelResponse.toolCalls[0].name).toBe(
      "tool_alpha",
    );
    expect(result.debugInfo?.turns[1].modelResponse.toolCalls[0].name).toBe(
      "tool_beta",
    );
    expect(result.debugInfo?.turns[2].modelResponse.text).toBe(
      "Completed both Alpha and Beta actions.",
    );

    expect(
      progressUpdates.some(
        (p) => p.status === "executing_tool" && p.toolName === "tool_alpha",
      ),
    ).toBe(true);
    expect(
      progressUpdates.some(
        (p) => p.status === "executing_tool" && p.toolName === "tool_beta",
      ),
    ).toBe(true);
  });

  it("handles multi-turn tool calling with Anthropic Claude", async () => {
    const dummyTool: AgentTool = {
      name: "tool_gamma",
      description: "Gamma tool",
      parameters: { type: "object", properties: {} },
      execute: vi
        .fn()
        .mockResolvedValue({ success: true, message: "Gamma done" }),
    };

    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // Round 1: Claude emits tool_use
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              content: [
                {
                  type: "tool_use",
                  id: "toolu_123",
                  name: "tool_gamma",
                  input: { setting: 42 },
                },
              ],
            }),
        });
      } else {
        // Round 2: Claude responds with text
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              content: [{ type: "text", text: "Gamma has completed." }],
            }),
        });
      }
    });

    const result = await executeHarnessTurn({
      model: "claude-sonnet-4-6",
      claudeApiKey: "test-claude-key",
      messages: [{ role: "user", text: "Execute gamma" }],
      tools: [dummyTool],
      context: mockContext,
    });

    expect(result.reply).toBe("Gamma has completed.");
    expect(result.executedTools).toHaveLength(1);
    expect(result.executedTools[0].name).toBe("tool_gamma");
    expect(result.executedTools[0].turn).toBe(1);
    expect(result.executedTools[0].step).toBe(1);
  });

  describe("Action Confirmation Infrastructure", () => {
    it("executes state-mutating tool when user approves confirmation", async () => {
      const executeMock = vi
        .fn()
        .mockResolvedValue({ success: true, message: "Changed time course" });
      const toolWithState: AgentTool = {
        name: "configure_time_course",
        description: "Configure time course",
        mutatesState: true,
        describeAction: (args) => `Change time course to ${args.endTime}s`,
        parameters: { type: "object", properties: {} },
        execute: executeMock,
      };

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: "call_time",
                          type: "function",
                          function: {
                            name: "configure_time_course",
                            arguments: '{"endTime": 100}',
                          },
                        },
                      ],
                    },
                  },
                ],
              }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "Time course configured to 100s.",
                    },
                  },
                ],
              }),
          });
        }
      });

      const confirmMock = vi.fn().mockResolvedValue(true);

      const result = await executeHarnessTurn({
        model: "gpt-5.4-mini",
        openAiApiKey: "test-key",
        messages: [{ role: "user", text: "Simulate for 100s" }],
        tools: [toolWithState],
        context: mockContext,
        requireConfirmation: true,
        onConfirmAction: confirmMock,
      });

      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "configure_time_course",
          description: "Change time course to 100s",
        }),
      );
      expect(executeMock).toHaveBeenCalled();
      expect(result.executedTools[0].result.success).toBe(true);
    });

    it("cancels execution when user rejects confirmation", async () => {
      const executeMock = vi.fn();
      const toolWithState: AgentTool = {
        name: "configure_time_course",
        description: "Configure time course",
        mutatesState: true,
        describeAction: (args) => `Change time course to ${args.endTime}s`,
        parameters: { type: "object", properties: {} },
        execute: executeMock,
      };

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: "call_time",
                          type: "function",
                          function: {
                            name: "configure_time_course",
                            arguments: '{"endTime": 100}',
                          },
                        },
                      ],
                    },
                  },
                ],
              }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "I cancelled the time course change.",
                    },
                  },
                ],
              }),
          });
        }
      });

      const confirmMock = vi.fn().mockResolvedValue(false);

      const result = await executeHarnessTurn({
        model: "gpt-5.4-mini",
        openAiApiKey: "test-key",
        messages: [{ role: "user", text: "Simulate for 100s" }],
        tools: [toolWithState],
        context: mockContext,
        requireConfirmation: true,
        onConfirmAction: confirmMock,
      });

      expect(confirmMock).toHaveBeenCalled();
      // Tool execute should NOT have been called!
      expect(executeMock).not.toHaveBeenCalled();
      expect(result.executedTools[0].result.success).toBe(false);
      expect(result.executedTools[0].result.error).toBe("USER_DECLINED_ACTION");
      expect(result.reply).toBe("I cancelled the time course change.");
    });

    it("passes detailed property changes and consequences to onConfirmAction", async () => {
      const executeMock = vi
        .fn()
        .mockResolvedValue({ success: true, message: "OK" });
      const detailedTool: AgentTool = {
        name: "configure_time_course",
        description: "Configure time course",
        mutatesState: true,
        describeAction: (args) => `Change time course to ${args.endTime}s`,
        describeChanges: (args) => ({
          summary: `Change time course to ${args.endTime}s`,
          changes: [
            {
              field: "End Time",
              currentValue: "10s",
              proposedValue: `${args.endTime}s`,
            },
          ],
          consequences: ["Re-runs ODE simulation"],
        }),
        parameters: { type: "object", properties: {} },
        execute: executeMock,
      };

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call_tc",
                        type: "function",
                        function: {
                          name: "configure_time_course",
                          arguments: '{"endTime": 50}',
                        },
                      },
                    ],
                  },
                },
              ],
            }),
        }),
      );

      const confirmMock = vi.fn().mockResolvedValue(false);

      await executeHarnessTurn({
        model: "gpt-5.4-mini",
        openAiApiKey: "test-key",
        messages: [{ role: "user", text: "Set end time to 50" }],
        tools: [detailedTool],
        context: mockContext,
        onConfirmAction: confirmMock,
      });

      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "configure_time_course",
          description: "Change time course to 50s",
          changes: [
            { field: "End Time", currentValue: "10s", proposedValue: "50s" },
          ],
          consequences: ["Re-runs ODE simulation"],
        }),
      );
    });

    it("preserves revertData and change details in executedTools when confirmation is disabled", async () => {
      const executeMock = vi
        .fn()
        .mockResolvedValue({ success: true, message: "OK" });
      const detailedTool: AgentTool = {
        name: "configure_time_course",
        description: "Configure time course",
        mutatesState: true,
        describeAction: (args) => `Change time course to ${args.endTime}s`,
        describeChanges: (args) => ({
          summary: `Change time course to ${args.endTime}s`,
          changes: [
            {
              field: "End Time",
              currentValue: "10s",
              proposedValue: `${args.endTime}s`,
            },
          ],
          consequences: ["Re-runs ODE simulation"],
        }),
        getRevertData: () => ({ previousEndTime: 10 }),
        parameters: { type: "object", properties: {} },
        execute: executeMock,
      };

      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        if (fetchCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: "call_tc_unconfirmed",
                          type: "function",
                          function: {
                            name: "configure_time_course",
                            arguments: '{"endTime": 80}',
                          },
                        },
                      ],
                    },
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "Configured without modal confirmation.",
                  },
                },
              ],
            }),
        });
      });

      const confirmMock = vi.fn();

      const result = await executeHarnessTurn({
        model: "gpt-5.4-mini",
        openAiApiKey: "test-key",
        messages: [{ role: "user", text: "Set end time to 80" }],
        tools: [detailedTool],
        context: mockContext,
        requireConfirmation: false,
        onConfirmAction: confirmMock,
      });

      expect(confirmMock).not.toHaveBeenCalled();
      expect(executeMock).toHaveBeenCalled();
      expect(result.executedTools).toHaveLength(1);
      const executed = result.executedTools[0];
      expect(executed.name).toBe("configure_time_course");
      expect(executed.description).toBe("Change time course to 80s");
      expect(executed.revertData).toEqual({ previousEndTime: 10 });
      expect(executed.changes).toEqual([
        { field: "End Time", currentValue: "10s", proposedValue: "80s" },
      ]);
      expect(executed.consequences).toEqual(["Re-runs ODE simulation"]);
    });

    it("accumulates and reports token usage across turns in debugInfo", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: "call_a",
                          type: "function",
                          function: { name: "tool_alpha", arguments: "{}" },
                        },
                      ],
                    },
                  },
                ],
                usage: {
                  prompt_tokens: 100,
                  completion_tokens: 25,
                  total_tokens: 125,
                  prompt_tokens_details: { cached_tokens: 10 },
                },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "Done processing.",
                  },
                },
              ],
              usage: {
                prompt_tokens: 150,
                completion_tokens: 30,
                total_tokens: 180,
                prompt_tokens_details: { cached_tokens: 15 },
              },
            }),
        });
      });

      const dummyTool: AgentTool = {
        name: "tool_alpha",
        description: "Test tool",
        parameters: { type: "object", properties: {} },
        execute: () => ({ success: true, message: "OK" }),
      };

      const result = await executeHarnessTurn({
        model: "gpt-5.4-mini",
        openAiApiKey: "test-key",
        messages: [{ role: "user", text: "Run analysis" }],
        tools: [dummyTool],
        context: mockContext,
        requireConfirmation: false,
      });

      expect(result.debugInfo?.usage).toEqual({
        promptTokens: 250,
        completionTokens: 55,
        totalTokens: 305,
        cachedTokens: 25,
      });
      expect(result.debugInfo?.turns[0].usage).toEqual({
        promptTokens: 100,
        completionTokens: 25,
        totalTokens: 125,
        cachedTokens: 10,
      });
      expect(result.debugInfo?.turns[1].usage).toEqual({
        promptTokens: 150,
        completionTokens: 30,
        totalTokens: 180,
        cachedTokens: 15,
      });
    });
  });
});
