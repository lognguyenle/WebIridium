import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderWithinWorkspace } from "@/testing-utils/render";
import ChatPanel from "../ChatPanel";

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupChatWithKey = async (openNewChat = true) => {
    await renderWithinWorkspace(<ChatPanel visible={true} />);

    await userEvent.click(screen.getByLabelText("Chat Settings"));

    const keyInput = screen.getByPlaceholderText("Enter OpenAI API key");
    await userEvent.type(keyInput, "sk-test-key");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await userEvent.click(screen.getAllByText("Save")[0]);

    await waitFor(() => {
      expect(screen.queryByText("Verifying...")).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Close"));

    if (openNewChat) {
      await userEvent.click(
        screen.getByRole("button", { name: /start new conversation/i }),
      );
    }
  };

  it("should display a verbose error message when API returns 401", async () => {
    await setupChatWithKey();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const input = screen.getByLabelText("Message input");
    await userEvent.type(input, "Hello");

    await userEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid API Key provided. (401)"),
      ).toBeInTheDocument();
    });

    const messages = screen.getAllByTestId("chat-message");
    const errorBubble = messages.find((m) =>
      within(m).queryByText("Invalid API Key provided. (401)"),
    );
    expect(errorBubble?.className).toMatch(/errorBubble/);
  });

  it("should display a verbose error message when API returns 429", async () => {
    await setupChatWithKey();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Too Many Requests"),
    });

    const input = screen.getByLabelText("Message input");
    await userEvent.type(input, "Hello again");

    await userEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Rate limit exceeded. Please wait a moment and try again. (429)",
        ),
      ).toBeInTheDocument();
    });
  });

  it("should display generic error for unknown errors", async () => {
    await setupChatWithKey();

    global.fetch = vi.fn().mockRejectedValue(new Error("Something exploded"));

    const input = screen.getByLabelText("Message input");
    await userEvent.type(input, "Boom");

    await userEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(screen.getByText("Error: Something exploded")).toBeInTheDocument();
    });
  });

  it("should render LaTeX as MathML with correct attributes", async () => {
    await setupChatWithKey();

    // Mock API response with LaTeX content
    const mockResponse = {
      output: [
        {
          type: "message",
          content: [
            {
              text: "Here is math: $$ E=mc^2 $$",
            },
          ],
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const input = screen.getByLabelText("Message input");
    await userEvent.type(input, "Show me math");
    await userEvent.click(screen.getByLabelText("Send message"));

    await screen.findByTestId("latex-math");
  });

  it("renders debug and execution details in conversation interface", async () => {
    await setupChatWithKey();

    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Model reply with full debug info",
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const input = screen.getByLabelText("Message input");
    await userEvent.type(input, "Debug request");
    await userEvent.click(screen.getByLabelText("Send message"));

    const matchingTexts = await screen.findAllByText(
      "Model reply with full debug info",
    );
    expect(matchingTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Debug & Execution Details")).toBeInTheDocument();
    expect(
      screen.getByText("Assembled System Prompt & Context"),
    ).toBeInTheDocument();
  });

  it("preserves scroll position when navigating away and back to chat", async () => {
    const ChatNavigator = () => {
      const [visible, setVisible] = useState(true);
      return (
        <div>
          <button onClick={() => setVisible((prev) => !prev)}>
            Toggle Panel
          </button>
          <ChatPanel visible={visible} />
        </div>
      );
    };

    await renderWithinWorkspace(<ChatNavigator />);

    await userEvent.click(screen.getByLabelText("Chat Settings"));
    const keyInput = screen.getByPlaceholderText("Enter OpenAI API key");
    await userEvent.type(keyInput, "sk-test-key");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await userEvent.click(screen.getAllByText("Save")[0]);
    await waitFor(() => {
      expect(screen.queryByText("Verifying...")).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Close"));
    await userEvent.click(
      screen.getByRole("button", { name: /start new conversation/i }),
    );

    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Response with detailed content to scroll through.",
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const input = screen.getByLabelText("Message input");
    await userEvent.type(input, "First message");
    await userEvent.click(screen.getByLabelText("Send message"));

    await screen.findAllByText(
      "Response with detailed content to scroll through.",
    );

    const chatRegion = screen.getByRole("region", { name: "Chat panel" });
    const messagesEl = chatRegion.querySelector(
      "[class*='messages']",
    ) as HTMLDivElement;
    expect(messagesEl).toBeTruthy();

    // Simulate user scrolling down into the message history
    Object.defineProperty(messagesEl, "scrollTop", {
      value: 350,
      writable: true,
      configurable: true,
    });
    fireEvent.scroll(messagesEl, { target: { scrollTop: 350 } });

    // Navigate away from chat (visible -> false)
    await userEvent.click(screen.getByText("Toggle Panel"));

    // Navigate back to chat (visible -> true)
    await userEvent.click(screen.getByText("Toggle Panel"));

    await waitFor(() => {
      expect(messagesEl.scrollTop).toBe(350);
    });
  });

  it("shows past conversations and an option to add a new one when the chat window is empty", async () => {
    const mockConversations = [
      {
        id: "conv-1",
        title: "Enzyme Kinetics Discussion",
        messages: [
          {
            id: "m-1",
            role: "user" as const,
            text: "Help me model Michaelis-Menten kinetics",
          },
          {
            id: "m-2",
            role: "llm" as const,
            text: "Here is the Antimony model for enzyme kinetics",
          },
        ],
        unixTimestampMs: Date.now() - 3600000,
      },
    ];
    localStorage.setItem("chat_history", JSON.stringify(mockConversations));
    localStorage.setItem("chat_apiKey", JSON.stringify("sk-test-key"));

    await renderWithinWorkspace(<ChatPanel visible={true} />);

    // Top option to start a new conversation
    expect(
      screen.getByRole("button", { name: /start new conversation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("New Conversation")).toBeInTheDocument();

    // Startup page should NOT render the chatbox at the bottom
    expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();

    // Past conversations section
    expect(screen.getByText("Past Conversations")).toBeInTheDocument();
    expect(screen.getByText("Enzyme Kinetics Discussion")).toBeInTheDocument();

    // Clicking the past conversation loads it into the chat window
    await userEvent.click(screen.getByText("Enzyme Kinetics Discussion"));

    await waitFor(() => {
      expect(
        screen.getByText("Help me model Michaelis-Menten kinetics"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Here is the Antimony model for enzyme kinetics"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Message input")).toBeInTheDocument();
    });

    // Clicking All Chats button in header returns to the startup page
    await userEvent.click(
      screen.getByRole("button", { name: /back to conversations/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("New Conversation")).toBeInTheDocument();
      expect(screen.getByText("Past Conversations")).toBeInTheDocument();
      expect(
        screen.getByText("Enzyme Kinetics Discussion"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();
    });
  });

  it("displays placeholder and focuses input when clicking New Conversation in empty view without history", async () => {
    await setupChatWithKey(false);

    expect(
      screen.getByRole("button", { name: /start new conversation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Past Conversations")).toBeInTheDocument();
    expect(screen.getByText("No past conversations yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /start new conversation/i }),
    );

    const input = screen.getByLabelText("Message input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("shows an entry page when no API keys have been entered and unlocks on key save", async () => {
    await renderWithinWorkspace(<ChatPanel visible={true} />);

    // Entry page is rendered
    expect(screen.getByText("Welcome to WebIridium AI")).toBeInTheDocument();
    expect(screen.getByText("API Key Setup")).toBeInTheDocument();
    expect(screen.getByLabelText("OpenAI API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Claude API Key")).toBeInTheDocument();

    // Mock API verification endpoint
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    // Enter and save OpenAI API key on entry page
    const openAiInput = screen.getByPlaceholderText(
      "Enter OpenAI API key (sk-...)",
    );
    await userEvent.type(openAiInput, "sk-valid-key");
    const saveButton = screen.getAllByRole("button", { name: "Save" })[0];
    await userEvent.click(saveButton);

    // Entry page transitions to startup page without message input
    await waitFor(() => {
      expect(
        screen.queryByText("Welcome to WebIridium AI"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("New Conversation")).toBeInTheDocument();
      expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();
    });

    // Clicking New Conversation navigates to chat page where input is rendered
    await userEvent.click(
      screen.getByRole("button", { name: /start new conversation/i }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Message input")).toBeInTheDocument();
    });
  });

  it("shows saved conversations on entry page when no API keys are configured", async () => {
    const mockConversations = [
      {
        id: "conv-1",
        title: "Previous Simulation Discussion",
        messages: [
          { id: "m-1", role: "user" as const, text: "Show steady state" },
          {
            id: "m-2",
            role: "llm" as const,
            text: "Steady state reached at t=10",
          },
        ],
        unixTimestampMs: Date.now() - 7200000,
      },
    ];
    localStorage.setItem("chat_history", JSON.stringify(mockConversations));

    await renderWithinWorkspace(<ChatPanel visible={true} />);

    // Entry page with saved conversations section
    expect(screen.getByText("Welcome to WebIridium AI")).toBeInTheDocument();
    expect(screen.getByText("Saved Conversations")).toBeInTheDocument();
    expect(
      screen.getByText("Previous Simulation Discussion"),
    ).toBeInTheDocument();

    // Clicking saved conversation opens it
    await userEvent.click(screen.getByText("Previous Simulation Discussion"));

    await waitFor(() => {
      expect(screen.getByText("Show steady state")).toBeInTheDocument();
      expect(
        screen.getByText("Steady state reached at t=10"),
      ).toBeInTheDocument();
    });
  });

  it("does not render chatbox on startup page and opens new chat page with input and empty state", async () => {
    localStorage.setItem("chat_apiKey", JSON.stringify("sk-test-key"));
    await renderWithinWorkspace(<ChatPanel visible={true} />);

    // On startup page: no chatbox
    expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start new conversation/i }),
    ).toBeInTheDocument();

    // Click start new conversation
    await userEvent.click(
      screen.getByRole("button", { name: /start new conversation/i }),
    );

    // On new conversation page: centered chatbox and new chat empty state are visible, NOT bottom chatbox
    const chatRegion = screen.getByRole("region", { name: "Chat panel" });
    const centerWrapper = chatRegion.querySelector(
      "[class*='newChatCenterWrapper']",
    );
    expect(centerWrapper).toBeInTheDocument();
    expect(
      within(centerWrapper as HTMLElement).getByLabelText("Message input"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Type a message below to begin chatting with the assistant.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to conversations/i }),
    ).toBeInTheDocument();

    // Click All Chats to go back
    await userEvent.click(
      screen.getByRole("button", { name: /back to conversations/i }),
    );

    // Back on startup page: no chatbox
    expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start new conversation/i }),
    ).toBeInTheDocument();
  });

  it("renders committed action records in message log and supports reverting and re-applying changes", async () => {
    localStorage.setItem("chat_apiKey", JSON.stringify("sk-test-key"));
    const mockConversations = [
      {
        id: "conv-actions",
        title: "Action History Test",
        messages: [
          { id: "m-user", role: "user" as const, text: "Extend simulation" },
          {
            id: "m-llm",
            role: "llm" as const,
            text: "I updated the simulation time course.",
            committedActions: [
              {
                id: "act-1",
                toolName: "configure_time_course",
                arguments: { endTime: 50 },
                description: "Configure time course simulation to 50s",
                changes: [
                  {
                    field: "End Time",
                    currentValue: "10",
                    proposedValue: "50",
                  },
                ],
                consequences: ["Runs simulation until t=50."],
                status: "committed" as const,
                timestamp: Date.now(),
                revertData: { startTime: 0, endTime: 10, numberOfPoints: 100 },
              },
            ],
          },
        ],
        unixTimestampMs: Date.now() - 1000,
      },
    ];
    localStorage.setItem("chat_history", JSON.stringify(mockConversations));

    await renderWithinWorkspace(<ChatPanel visible={true} />);

    // Open conversation from saved list
    await userEvent.click(screen.getByText("Action History Test"));

    // Verify committed action record details are rendered
    await waitFor(() => {
      expect(screen.getByText("Committed Action")).toBeInTheDocument();
      expect(screen.getByText("configure_time_course")).toBeInTheDocument();
      expect(
        screen.getByText("Configure time course simulation to 50s"),
      ).toBeInTheDocument();
      expect(screen.getByText("End Time")).toBeInTheDocument();
      expect(screen.getByText("50")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /revert change/i }),
      ).toBeInTheDocument();
    });

    // Click Revert Change
    await userEvent.click(
      screen.getByRole("button", { name: /revert change/i }),
    );

    // Verify status changes to Reverted and Re-apply button appears
    await waitFor(() => {
      expect(screen.getByText("Reverted Action")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /re-apply change/i }),
      ).toBeInTheDocument();
    });

    // Check localStorage was updated with reverted status
    const saved = JSON.parse(localStorage.getItem("chat_history") || "[]");
    const savedAction = saved[0]?.messages?.[1]?.committedActions?.[0];
    expect(savedAction?.status).toBe("reverted");

    // Click Re-apply Change
    await userEvent.click(
      screen.getByRole("button", { name: /re-apply change/i }),
    );

    // Verify status returns to Committed
    await waitFor(() => {
      expect(screen.getByText("Committed Action")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /revert change/i }),
      ).toBeInTheDocument();
    });
  });
});
