import { useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useSetAtom, useStore } from "jotai";

import {
  chatHistoryAtom,
  activeConversationAtom,
  upsertActiveConversationAtom,
  deleteConversationAtom,
  openAiApiKeyAtom,
  claudeApiKeyAtom,
  systemPromptAtom,
  DEFAULT_SYSTEM_PROMPT,
  modelAtom,
  AVAILABLE_MODELS,
  confirmToolActionsAtom,
  showDebugDetailsAtom,
} from "@/globals/chat";
import styles from "./ChatPanel.module.css";
import PanelTitle from "../components/PanelTitle";
import PulseLoader from "../components/PulseLoader";
import { timeToAgoText } from "@/features/formatUtils";
import { getVerboseError } from "@/features/chat/errorUtils";
import { Tooltip } from "@/components/Tooltip";
import { ContextMenu } from "radix-ui";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import SettingsIcon from "@/assets/icons/SettingsIcon.svg?react";
import HistoryIcon from "@/assets/icons/HistoryIcon.svg?react";
import PlusIcon from "@/assets/icons/PlusIcon.svg?react";
import CheckIcon from "@/assets/icons/CheckIcon.svg?react";
import SendIcon from "@/assets/icons/SendIcon.svg?react";
import TrashIcon from "@/assets/icons/TrashIcon.svg?react";
import DownloadIcon from "@/assets/icons/DownloadIcon.svg?react";
import UploadIcon from "@/assets/icons/UploadIcon.svg?react";
import PencilIcon from "@/assets/icons/PencilIcon.svg?react";
import CrossIcon from "@/assets/icons/CrossIcon.svg?react";
import RobotIcon from "@/assets/icons/RobotIcon.svg?react";
import ChevronDownIcon from "@/assets/icons/ChevronDownIcon.svg?react";
import IconButton from "@/components/IconButton";

import Select from "@/components/input/Select";

import {
  executeHarnessTurn,
  type ExecutedToolRecord,
  type ConfirmationRequest,
  type AgentDebugInfo,
  type CommittedActionRecord,
  simulationTools,
  getJotaiToolContext,
  assembleAgentSystemPrompt,
} from "@/features/chat/harness";
import type { ChatConversation } from "@/globals/chat";
import clsx from "clsx";

export interface ChatPanelProps {
  visible: boolean;
}

type Message = {
  id: string;
  role: "user" | "llm";
  text: string;
  thinking?: boolean;
  isError?: boolean;
  statusText?: string;
  executedTools?: ExecutedToolRecord[];
  committedActions?: CommittedActionRecord[];
  debugInfo?: AgentDebugInfo;
};

const ConversationItem = ({
  conv,
  selected,
  setMessages,
  setShowHistory,
  setActiveConversation,
  disabled,
}: {
  conv: ChatConversation;
  selected: boolean;
  setMessages: (to: Message[]) => void;
  setShowHistory: (to: boolean) => void;
  setActiveConversation: (to: ChatConversation) => void;
  disabled?: boolean;
}) => {
  const [timestampMs, setTimestampMs] = useState(() => Date.now());
  const time = timeToAgoText(timestampMs - conv.unixTimestampMs).toLowerCase();

  useEffect(() => {
    const id = setInterval(() => {
      setTimestampMs(Date.now());
    }, 60 * 1_000);

    return () => clearInterval(id);
  }, []);

  return (
    <button
      key={conv.id}
      className={styles.historyItem}
      onClick={() => {
        setMessages(
          conv.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            isError: m.isError,
            statusText: m.statusText,
            executedTools: m.executedTools,
            committedActions: m.committedActions,
          })),
        );
        setShowHistory(false);
        setActiveConversation(conv);
      }}
      disabled={disabled}
    >
      <div className={styles.historyMain}>
        <span className={styles.historyTitle}>{conv.title}</span>
        <span className={styles.historySubtitle}>{time}</span>
      </div>

      <div className={styles.historyCheck}>
        {selected && <CheckIcon width="1em" height="1em" aria-hidden />}
      </div>
    </button>
  );
};

const PastConversationCard = ({
  conv,
  onSelect,
  onDelete,
  disabled,
}: {
  conv: ChatConversation;
  onSelect: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) => {
  const [timestampMs, setTimestampMs] = useState(() => Date.now());
  const time = timeToAgoText(timestampMs - conv.unixTimestampMs).toLowerCase();

  useEffect(() => {
    const id = setInterval(() => {
      setTimestampMs(Date.now());
    }, 60 * 1_000);

    return () => clearInterval(id);
  }, []);

  const messageCount = conv.messages.length;
  const firstUserMessage = conv.messages
    .find((m) => m.role === "user")
    ?.text?.trim();
  const lastMessage = conv.messages[conv.messages.length - 1]?.text?.trim();
  const previewText = firstUserMessage || lastMessage || "";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={clsx(
        styles.pastConversationCard,
        disabled && styles.pastConversationCardDisabled,
      )}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Open conversation: ${conv.title || "Untitled Conversation"}`}
    >
      <div className={styles.pastConversationCardHeader}>
        <span className={styles.pastConversationCardTitle}>
          {conv.title || "Untitled Conversation"}
        </span>
        <div className={styles.pastConversationCardActions}>
          <span className={styles.pastConversationCardTime}>{time}</span>
          <button
            type="button"
            className={styles.pastConversationCardDelete}
            title="Delete conversation"
            aria-label={`Delete conversation ${conv.title || "Untitled Conversation"}`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon width="0.85em" height="0.85em" aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.pastConversationCardFooter}>
        <span className={styles.pastConversationCardCount}>
          {messageCount} {messageCount === 1 ? "message" : "messages"}
        </span>
        {previewText && (
          <span className={styles.pastConversationCardPreview}>
            -{" "}
            {previewText.length > 55
              ? `${previewText.slice(0, 55)}...`
              : previewText}
          </span>
        )}
      </div>
    </div>
  );
};

interface ApiKeyEntryFieldProps {
  label: string;
  apiKey: string | null;
  placeholder: string;
  disabled: boolean;
  onSave: (key: string) => Promise<void>;
  onClear: () => void;
  style?: React.CSSProperties;
}

const ApiKeyEntryField = ({
  label,
  apiKey,
  placeholder,
  disabled,
  onSave,
  onClear,
  style,
}: ApiKeyEntryFieldProps) => {
  const [input, setInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!input) return;
    setIsVerifying(true);
    setError(null);
    try {
      await onSave(input);
      setInput("");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : `Failed to verify ${label}`,
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={style}>
      <div
        className={styles.settingsLabel}
        style={{ marginBottom: "var(--spacing-1)" }}
      >
        {label}
      </div>
      {apiKey ? (
        <div className={styles.keyStatus}>
          <div className={styles.keyActive}>
            <CheckIcon width="1em" height="1em" />
            <span>{label} is set</span>
          </div>
          <button
            className={styles.clearKeyButton}
            onClick={onClear}
            disabled={disabled}
          >
            Clear Key
          </button>
        </div>
      ) : (
        <>
          <div className={styles.apiKeyRow}>
            <input
              type="password"
              className={styles.apiKeyInput}
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={label}
            />
            <button
              className={styles.apiKeyButton}
              onClick={handleSave}
              disabled={!input || isVerifying || disabled}
            >
              {isVerifying ? "Verifying..." : "Save"}
            </button>
          </div>
          {error && (
            <div className={styles.verificationError}>Error: {error}</div>
          )}
        </>
      )}
    </div>
  );
};

const verifyOpenAiKey = async (keyInput: string) => {
  if (!keyInput.startsWith("sk-")) {
    throw new Error("Invalid API Key format (must start with sk-)");
  }

  const resp = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${keyInput}` },
  });

  if (!resp.ok) {
    throw new Error(`Invalid API Key (Status ${resp.status})`);
  }
};

const verifyClaudeKey = async (keyInput: string) => {
  if (!keyInput.startsWith("sk-")) {
    throw new Error("Invalid API Key format (must start with sk-)");
  }

  const resp = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": keyInput,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Invalid API Key (Status ${resp.status}): ${text.slice(0, 100)}`,
    );
  }
};

const ChatSettings = ({
  openAiApiKey,
  setOpenAiApiKey,
  claudeApiKey,
  setClaudeApiKey,
  confirmToolActions,
  setConfirmToolActions,
  showDebugDetails,
  setShowDebugDetails,
  onClose,
  waitingForReply,
}: {
  openAiApiKey: string | null;
  setOpenAiApiKey: (key: string | null) => void;
  claudeApiKey: string | null;
  setClaudeApiKey: (key: string | null) => void;
  confirmToolActions: boolean;
  setConfirmToolActions: (val: boolean) => void;
  showDebugDetails: boolean;
  setShowDebugDetails: (val: boolean) => void;
  onClose: () => void;
  waitingForReply: boolean;
}) => {
  const [systemPrompt, setSystemPrompt] = useAtom(systemPromptAtom);
  const [promptInput, setPromptInput] = useState(systemPrompt);

  // Sync local state when global state changes (e.g. reset)
  useEffect(() => {
    setPromptInput(systemPrompt);
  }, [systemPrompt]);

  const verifyAndSaveOpenAiKey = async (keyInput: string) => {
    await verifyOpenAiKey(keyInput);
    setOpenAiApiKey(keyInput);
  };

  const verifyAndSaveClaudeKey = async (keyInput: string) => {
    await verifyClaudeKey(keyInput);
    setClaudeApiKey(keyInput);
  };

  const handleSavePrompt = () => {
    setSystemPrompt(promptInput);
  };

  const handleResetPrompt = () => {
    setPromptInput(DEFAULT_SYSTEM_PROMPT);
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <h3 className={styles.settingsTitle}>Settings</h3>
        <button className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.settingsSection}>
        <ApiKeyEntryField
          label="OpenAI API Key"
          apiKey={openAiApiKey}
          placeholder="Enter OpenAI API key"
          disabled={waitingForReply}
          onSave={verifyAndSaveOpenAiKey}
          onClear={() => setOpenAiApiKey(null)}
        />

        <ApiKeyEntryField
          label="Claude API Key"
          apiKey={claudeApiKey}
          placeholder="Enter Claude API key"
          disabled={waitingForReply}
          onSave={verifyAndSaveClaudeKey}
          onClear={() => setClaudeApiKey(null)}
          style={{ marginTop: "0.25rem" }}
        />

        <div className={styles.settingsNote}>
          Your API key is stored locally and never shared.
        </div>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsLabel}>System Prompt</div>
        <textarea
          className={styles.settingsTextarea}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Enter system prompt..."
          rows={4}
          disabled={waitingForReply}
        />
        <div className={styles.settingsActions}>
          <button
            className={styles.secondaryButton}
            onClick={handleResetPrompt}
            disabled={waitingForReply || promptInput === DEFAULT_SYSTEM_PROMPT}
          >
            Reset to Default
          </button>
          <button
            className={styles.primaryButton}
            onClick={handleSavePrompt}
            disabled={waitingForReply || promptInput === systemPrompt}
          >
            Save Prompt
          </button>
        </div>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsLabel}>Agent Safety & Confirmation</div>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={confirmToolActions}
            onChange={(e) => setConfirmToolActions(e.target.checked)}
            disabled={waitingForReply}
          />
          Ask for user confirmation before executing actions that modify
          simulation state
        </label>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsLabel}>Diagnostics & Debugging</div>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showDebugDetails}
            onChange={(e) => setShowDebugDetails(e.target.checked)}
            disabled={waitingForReply}
          />
          Show debug diagnostics and execution logs in conversation
        </label>
      </div>
    </div>
  );
};

const ChatEntryPage = ({
  openAiApiKey,
  setOpenAiApiKey,
  claudeApiKey,
  setClaudeApiKey,
  chatHistory,
  onSelectConversation,
  onDeleteConversation,
  waitingForReply,
  scrollRef,
  onScroll,
}: {
  openAiApiKey: string | null;
  setOpenAiApiKey: (key: string | null) => void;
  claudeApiKey: string | null;
  setClaudeApiKey: (key: string | null) => void;
  chatHistory: ChatConversation[];
  onSelectConversation: (conv: ChatConversation) => void;
  onDeleteConversation: (conv: ChatConversation) => void;
  waitingForReply: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}) => {
  const handleSaveOpenAiKey = async (keyInput: string) => {
    await verifyOpenAiKey(keyInput);
    setOpenAiApiKey(keyInput);
  };

  const handleSaveClaudeKey = async (keyInput: string) => {
    await verifyClaudeKey(keyInput);
    setClaudeApiKey(keyInput);
  };

  return (
    <div
      className={styles.entryPageContainer}
      ref={scrollRef}
      onScroll={onScroll}
    >
      <div className={styles.entryPageHeader}>
        <div className={styles.entryPageBadge}>Setup Required</div>
        <h2 className={styles.entryPageTitle}>Welcome to WebIridium AI</h2>
        <p className={styles.entryPageSubtitle}>
          An AI assistant capable of creating and debugging Antimony models,
          running time-course simulations, configuring parameter scans, and
          curating interactive plots.
        </p>
      </div>

      <div className={styles.entryPageCard}>
        <div className={styles.entryPageCardHeader}>
          <span className={styles.entryPageCardTitle}>API Key Setup</span>
          <span className={styles.entryPageCardDesc}>
            Enter an API key below to get started with the assistant.
          </span>
        </div>

        <div className={styles.entryPageFields}>
          <ApiKeyEntryField
            label="OpenAI API Key"
            apiKey={openAiApiKey}
            placeholder="Enter OpenAI API key (sk-...)"
            disabled={waitingForReply}
            onSave={handleSaveOpenAiKey}
            onClear={() => setOpenAiApiKey(null)}
          />

          <ApiKeyEntryField
            label="Claude API Key"
            apiKey={claudeApiKey}
            placeholder="Enter Claude API key (sk-...)"
            disabled={waitingForReply}
            onSave={handleSaveClaudeKey}
            onClear={() => setClaudeApiKey(null)}
            style={{ marginTop: "var(--spacing-2)" }}
          />
        </div>

        <div className={styles.entryPageNote}>
          <span>
            API keys are stored strictly in your browser local storage and
            communicated directly to OpenAI or Anthropic.
          </span>
        </div>
      </div>

      {chatHistory.length > 0 && (
        <div className={styles.entryPageHistorySection}>
          <div className={styles.pastConversationsHeader}>
            <span className={styles.pastConversationsTitle}>
              Saved Conversations
            </span>
            <span className={styles.pastConversationsCount}>
              {chatHistory.length}
            </span>
          </div>
          <div className={styles.pastConversationsList}>
            {chatHistory
              .slice()
              .reverse()
              .map((conv) => (
                <PastConversationCard
                  key={conv.id}
                  conv={conv}
                  onSelect={() => onSelectConversation(conv)}
                  onDelete={() => onDeleteConversation(conv)}
                  disabled={waitingForReply}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
// Helper function to extract raw LaTeX from the rehype-katex parsed MathML AST
type HastNode = {
  tagName?: string;
  properties?: Record<string, string>;
  children?: HastNode[];
  value?: string;
};

const extractRawLatexFromHast = (nodeRaw: unknown): string => {
  const node = nodeRaw as HastNode;
  if (
    node?.tagName === "annotation" &&
    node.properties?.encoding === "application/x-tex"
  ) {
    return node.children?.[0]?.value || "";
  }
  if (node?.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = extractRawLatexFromHast(child);
      if (result) return result;
    }
  }
  return "";
};

const ChatPanel = ({ visible }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [waitingForReply, setWaitingForReply] = useState(false);

  const [openAiApiKey, setOpenAiApiKey] = useAtom(openAiApiKeyAtom);
  const [claudeApiKey, setClaudeApiKey] = useAtom(claudeApiKeyAtom);
  const [systemPrompt] = useAtom(systemPromptAtom);
  const [model, setModel] = useAtom(modelAtom);
  const activeModelObj = AVAILABLE_MODELS.find((m) => m.id === model);
  const isClaude = activeModelObj?.provider === "anthropic";
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const [viewMode, setViewMode] = useState<"startup" | "chat">("startup");
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatHistory] = useAtom(chatHistoryAtom);
  const [confirmToolActions, setConfirmToolActions] = useAtom(
    confirmToolActionsAtom,
  );
  const [showDebugDetails, setShowDebugDetails] = useAtom(showDebugDetailsAtom);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    request: ConfirmationRequest;
    resolve: (approved: boolean) => void;
    messageId: string;
  } | null>(null);
  const [revertingActionId, setRevertingActionId] = useState<string | null>(
    null,
  );
  const store = useStore();
  const toolContext = useMemo(() => getJotaiToolContext(store), [store]);
  const [activeConversation, setActiveConversation] = useAtom(
    activeConversationAtom,
  );

  const upsertActiveConversation = useSetAtom(upsertActiveConversationAtom);
  const deleteConversation = useSetAtom(deleteConversationAtom);

  const [conversationToDelete, setConversationToDelete] =
    useState<ChatConversation | null>(null);
  const [renameInput, setRenameInput] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const hasAnyApiKey = Boolean(openAiApiKey || claudeApiKey);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const prevVisibleRef = useRef(visible);
  const savedScrollTopRef = useRef<number | null>(null);
  const conversationScrollPositionsRef = useRef<Map<string, number>>(new Map());
  const pendingScrollToResponseRef = useRef(false);
  const lastHandledCompletedIdRef = useRef<string | null>(null);
  const isRestoringScrollRef = useRef(false);

  const scrollToLastResponseTop = (smooth = true) => {
    const el = messagesRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const lastMessageEl = el.lastElementChild;
      if (lastMessageEl) {
        const targetTop = lastMessageEl.getBoundingClientRect().top;
        const containerTop = el.getBoundingClientRect().top;
        const scrollTop = targetTop - containerTop + el.scrollTop;
        if (smooth && el.scrollTo) {
          el.scrollTo({ top: scrollTop, behavior: "smooth" });
        } else if (el.scrollTo) {
          el.scrollTo({ top: scrollTop, behavior: "instant" });
        } else {
          el.scrollTop = scrollTop;
        }
        savedScrollTopRef.current = scrollTop;
        const currentConvKey = activeConversation?.id ?? "__active__";
        conversationScrollPositionsRef.current.set(currentConvKey, scrollTop);
      }
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!visibleRef.current || isRestoringScrollRef.current) return;
    const top = e.currentTarget.scrollTop;
    if (top > 0 || messages.length === 0) {
      savedScrollTopRef.current = top;
      const currentConvKey = activeConversation?.id ?? "__active__";
      conversationScrollPositionsRef.current.set(currentConvKey, top);
    }
  };

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (!visibleRef.current) {
      if (lastMessage.role === "llm" && !lastMessage.thinking) {
        pendingScrollToResponseRef.current = true;
      }
      return;
    }

    if (lastMessage.role === "llm" && !lastMessage.thinking) {
      if (lastHandledCompletedIdRef.current !== lastMessage.id) {
        lastHandledCompletedIdRef.current = lastMessage.id;
        scrollToLastResponseTop(true);
      }
    } else if (lastMessage.thinking) {
      el.scrollTop = el.scrollHeight;
      savedScrollTopRef.current = el.scrollHeight;
      const currentConvKey = activeConversation?.id ?? "__active__";
      conversationScrollPositionsRef.current.set(
        currentConvKey,
        el.scrollHeight,
      );
    }
  }, [messages]);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (!wasVisible && visible) {
      // User navigated back to the chat
      const el = messagesRef.current;
      if (!el) return;

      if (pendingScrollToResponseRef.current) {
        pendingScrollToResponseRef.current = false;
        scrollToLastResponseTop(false);
        return;
      }

      const currentConvKey = activeConversation?.id ?? "__active__";
      const savedPos =
        conversationScrollPositionsRef.current.get(currentConvKey) ??
        savedScrollTopRef.current;

      if (savedPos !== null && savedPos !== undefined && savedPos > 0) {
        isRestoringScrollRef.current = true;
        const restore = () => {
          if (el) {
            if (el.scrollTo) {
              el.scrollTo({ top: savedPos, behavior: "instant" });
            }
            el.scrollTop = savedPos;
          }
        };

        restore();
        requestAnimationFrame(() => {
          restore();
          setTimeout(() => {
            restore();
            isRestoringScrollRef.current = false;
          }, 50);
        });
      }
    }
  }, [visible, activeConversation]);

  const saveConversation = (newMessages: Message[]) => {
    const nonThinking = newMessages.filter(
      (m) =>
        !m.thinking &&
        (m.text || (m.committedActions && m.committedActions.length > 0)),
    );
    if (nonThinking.length === 0) return;

    const conv = nonThinking.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      isError: m.isError,
      statusText: m.statusText,
      executedTools: m.executedTools,
      committedActions: m.committedActions,
      debugInfo: m.debugInfo,
    }));

    try {
      void upsertActiveConversation({ messages: conv });
    } catch (_e) {
      void _e;
    }
  };

  const handleResolveConfirmation = (approved: boolean) => {
    if (!pendingConfirmation) return;
    const { request, resolve, messageId } = pendingConfirmation;

    const actionRecord: CommittedActionRecord = {
      id: request.id || `action-${Date.now()}`,
      toolName: request.toolName,
      arguments: request.arguments,
      description: request.description,
      changes: request.changes,
      consequences: request.consequences,
      status: approved ? "committed" : "discarded",
      timestamp: Date.now(),
      revertData: request.revertData,
    };

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              committedActions: [...(m.committedActions || []), actionRecord],
            }
          : m,
      ),
    );

    resolve(approved);
    setPendingConfirmation(null);
  };

  const handleRevertAction = async (messageId: string, actionId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || !msg.committedActions) return;
    const action = msg.committedActions.find((a) => a.id === actionId);
    if (!action || !action.revertData) return;

    const tool = simulationTools.find((t) => t.name === action.toolName);
    if (!tool || !tool.revert) return;

    setRevertingActionId(actionId);
    try {
      await tool.revert(action.revertData, toolContext);

      const updatedMessages = messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              committedActions: m.committedActions?.map((a) =>
                a.id === actionId ? { ...a, status: "reverted" as const } : a,
              ),
            }
          : m,
      );
      setMessages(updatedMessages);
      saveConversation(updatedMessages);
    } catch (err) {
      console.error("Failed to revert action:", err);
    } finally {
      setRevertingActionId(null);
    }
  };

  const handleReapplyAction = async (messageId: string, actionId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || !msg.committedActions) return;
    const action = msg.committedActions.find((a) => a.id === actionId);
    if (!action) return;

    const tool = simulationTools.find((t) => t.name === action.toolName);
    if (!tool) return;

    setRevertingActionId(actionId);
    try {
      await tool.execute(action.arguments, toolContext);

      const updatedMessages = messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              committedActions: m.committedActions?.map((a) =>
                a.id === actionId ? { ...a, status: "committed" as const } : a,
              ),
            }
          : m,
      );
      setMessages(updatedMessages);
      saveConversation(updatedMessages);
    } catch (err) {
      console.error("Failed to re-apply action:", err);
    } finally {
      setRevertingActionId(null);
    }
  };

  const toggleHistory = () => {
    setShowHistory((show) => !show);
    setShowSettings(false);
  };

  const toggleSettings = () => {
    setShowSettings((show) => !show);
    setShowHistory(false);
  };

  const handleDeleteConversation = () => {
    if (!conversationToDelete) return;
    deleteConversation(conversationToDelete.id);
    if (activeConversation?.id === conversationToDelete.id) {
      setMessages([]);
      setActiveConversation(null);
      setViewMode("startup");
    }
    setConversationToDelete(null);
  };

  const handleOpenNewChatPage = () => {
    setViewMode("chat");
    setMessages([]);
    setActiveConversation(null);
    lastHandledCompletedIdRef.current = null;
    savedScrollTopRef.current = 0;
    if (messagesRef.current) {
      messagesRef.current.scrollTop = 0;
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleBackToStartup = () => {
    setViewMode("startup");
    setMessages([]);
    setActiveConversation(null);
    lastHandledCompletedIdRef.current = null;
    savedScrollTopRef.current = 0;
    if (messagesRef.current) {
      messagesRef.current.scrollTop = 0;
    }
  };

  const handleStartNewChat = () => {
    handleOpenNewChatPage();
  };

  const handleSelectConversation = (conv: ChatConversation) => {
    setViewMode("chat");
    setMessages(
      conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        isError: m.isError,
        statusText: m.statusText,
        executedTools: m.executedTools,
        committedActions: m.committedActions,
        debugInfo: m.debugInfo,
      })),
    );
    setShowHistory(false);
    setActiveConversation(conv);
  };

  const confirmRename = () => {
    const input = renameInputRef.current;
    if (input && activeConversation) {
      const trimmed = input.value.trim();
      if (trimmed) {
        upsertActiveConversation({
          messages: activeConversation.messages,
          title: trimmed,
        });
      }
      input.blur();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Enter") {
      confirmRename();
    }
  };

  const handleExportConversation = () => {
    if (!activeConversation) return;
    const json = JSON.stringify(activeConversation, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeConversation.title ?? "conversation"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConversation = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<
          string,
          unknown
        >;
        if (!data.id || !data.messages || !data.unixTimestampMs) {
          alert(
            "Invalid conversation file: missing required fields (id, messages, unixTimestampMs).",
          );
          return;
        }
        const conv =
          data as unknown as import("@/globals/chat").ChatConversation;
        setActiveConversation(null);
        upsertActiveConversation({
          messages: conv.messages,
          title: conv.title,
        });
        setMessages(
          conv.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            isError: m.isError,
            statusText: m.statusText,
            executedTools: m.executedTools,
            committedActions: m.committedActions,
            debugInfo: m.debugInfo,
          })),
        );
      } catch {
        alert(
          "Failed to parse conversation file. Please ensure it is valid JSON.",
        );
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (waitingForReply) return;

    if (isClaude && !claudeApiKey) return;
    if (!isClaude && !openAiApiKey) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      text: trimmed,
    };

    const placeholderId = `llm-pending-${Date.now()}`;
    const llmPlaceholder: Message = {
      id: placeholderId,
      role: "llm",
      text: "",
      thinking: true,
    };

    // append placeholder and clear input immediately
    lastHandledCompletedIdRef.current = null;
    const newMessages = [...messages, userMsg, llmPlaceholder];
    setMessages(newMessages);
    setInput("");
    // reset inline height so textarea returns to default after send
    if (inputRef.current) inputRef.current.style.height = "";
    setWaitingForReply(true);
    try {
      const harnessResult = await executeHarnessTurn({
        model,
        openAiApiKey,
        claudeApiKey,
        context: toolContext,
        messages: newMessages
          .filter((m) => !m.thinking)
          .map((m) => ({ role: m.role, text: m.text })),
        promptOptions: {
          userSystemPrompt: systemPrompt,
          includeModelContext: true,
        },
        requireConfirmation: confirmToolActions,
        onConfirmAction: (request) =>
          new Promise<boolean>((resolve) => {
            setPendingConfirmation({
              request,
              resolve,
              messageId: placeholderId,
            });
          }),
        onProgress: (progress) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? {
                    ...m,
                    statusText: progress.message,
                  }
                : m,
            ),
          );
        },
      });

      setMessages((prev) => {
        const finalized = prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: harnessResult.reply,
                thinking: false,
                executedTools: harnessResult.executedTools,
                debugInfo: harnessResult.debugInfo,
              }
            : m,
        );
        saveConversation(finalized);
        return finalized;
      });
    } catch (err: unknown) {
      setMessages((prev) => {
        const finalized = prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: getVerboseError(err),
                thinking: false,
                isError: true,
                debugInfo: {
                  provider: (isClaude ? "anthropic" : "openai") as
                    | "anthropic"
                    | "openai",
                  model,
                  systemPrompt: assembleAgentSystemPrompt(toolContext, {
                    userSystemPrompt: systemPrompt,
                    includeModelContext: true,
                  }),
                  initialMessages: newMessages
                    .filter((m) => !m.thinking)
                    .map((m) => ({ role: m.role, text: m.text })),
                  totalTurns: 0,
                  totalSteps: 0,
                  turns: [],
                },
              }
            : m,
        );
        saveConversation(finalized);
        return finalized;
      });
    } finally {
      setPendingConfirmation(null);
      setWaitingForReply(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<
    HTMLTextAreaElement
  > = async () => {
    // Prevent sending messages with keyboard shortcuts
    // Users must use the send button instead
  };

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";

    const computedStyle = window.getComputedStyle(ta);
    const maxHeightStr = computedStyle.maxHeight || "0px";
    const maxHeight = parseFloat(maxHeightStr.replace("px", "")) || Infinity;

    const newHeight = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = `${newHeight}px`;
    ta.style.overflow = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  const renderInputRow = (isCentered = false) => (
    <div
      className={clsx(styles.inputRow, isCentered && styles.inputRowCentered)}
    >
      <div className={styles.inputColumn}>
        <div className={styles.inputWrapper}>
          {(!isClaude && !openAiApiKey) || (isClaude && !claudeApiKey) ? (
            <div className={styles.overlay} aria-hidden="true">
              <div className={styles.overlayContent}>
                <div>
                  Please enter {isClaude ? "a Claude" : "an OpenAI"} API key in
                  settings
                </div>
              </div>
            </div>
          ) : null}

          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder="Type a message..."
            aria-label="Message input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={
              waitingForReply || (isClaude ? !claudeApiKey : !openAiApiKey)
            }
          />
        </div>
        <div className={styles.inputToolbar}>
          <Select
            name="Model"
            value={model}
            onChange={setModel}
            options={Object.fromEntries(
              AVAILABLE_MODELS.map((m) => [m.name, m.id]),
            )}
            className={styles.modelSelector}
            aria-label="Select Model"
          />
          <button
            id="chat-enter-button"
            className={styles.sendButton}
            aria-label="Send message"
            onClick={sendMessage}
            disabled={
              waitingForReply ||
              (isClaude ? !claudeApiKey : !openAiApiKey) ||
              !input.trim()
            }
          >
            <SendIcon width="1em" height="1em" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={clsx(styles.panel, !visible && styles.panelHidden)}
      aria-hidden={!visible ? "true" : undefined}
    >
      <div className={styles.titleRow}>
        <PanelTitle title="Chat" />
        <div>
          <button
            className={styles.titleButton}
            aria-label="Delete Conversation"
            onClick={() => {
              if (activeConversation) {
                setConversationToDelete(activeConversation);
              }
            }}
            disabled={!activeConversation || waitingForReply}
          >
            <Tooltip text="Delete Conversation">
              <TrashIcon height="0.75em" width="0.75em" />
            </Tooltip>
          </button>
          <button
            className={styles.titleButton}
            aria-label="Export Conversation"
            onClick={handleExportConversation}
            disabled={!activeConversation || waitingForReply}
          >
            <Tooltip text="Export Conversation">
              <DownloadIcon height="0.75em" width="0.75em" />
            </Tooltip>
          </button>
          <button
            className={styles.titleButton}
            aria-label="Import Conversation"
            onClick={() => fileInputRef.current?.click()}
            disabled={waitingForReply}
          >
            <Tooltip text="Import Conversation">
              <UploadIcon height="0.75em" width="0.75em" />
            </Tooltip>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImportConversation}
            aria-label="Import conversation file"
          />
          <button
            className={styles.titleButton}
            aria-expanded={showHistory}
            aria-label="Chat History"
            onClick={toggleHistory}
          >
            <Tooltip text="Chat History">
              <HistoryIcon height="0.75em" width="0.75em" />
            </Tooltip>
          </button>
          <button
            className={styles.titleButton}
            aria-expanded={showSettings}
            aria-label="Chat Settings"
            onClick={toggleSettings}
          >
            <Tooltip text="Chat Settings">
              <SettingsIcon height="0.75em" width="0.75em" />
            </Tooltip>
          </button>
          <button
            className={styles.titleButton}
            aria-expanded={showSettings}
            aria-label="New Chat"
            onClick={handleStartNewChat}
          >
            <Tooltip text="New Chat">
              <PlusIcon height="0.75em" width="0.75em" />
            </Tooltip>
          </button>
        </div>
      </div>

      {conversationToDelete && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>
              Are you sure you want to delete &quot;
              {conversationToDelete.title || "this conversation"}&quot;?
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.dangerButton}
                onClick={handleDeleteConversation}
              >
                Delete
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => setConversationToDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.chatBox} role="region" aria-label="Chat panel">
        {showSettings ? (
          <ChatSettings
            openAiApiKey={openAiApiKey}
            setOpenAiApiKey={setOpenAiApiKey}
            claudeApiKey={claudeApiKey}
            setClaudeApiKey={setClaudeApiKey}
            confirmToolActions={confirmToolActions}
            setConfirmToolActions={setConfirmToolActions}
            showDebugDetails={showDebugDetails}
            setShowDebugDetails={setShowDebugDetails}
            onClose={() => setShowSettings(false)}
            waitingForReply={waitingForReply}
          />
        ) : null}

        {showHistory ? (
          <div className={styles.settingsPanel}>
            <div className={styles.historyList}>
              {chatHistory.length === 0 ? (
                <div className={styles.settingsNote}>
                  No saved conversations
                </div>
              ) : (
                chatHistory
                  .slice()
                  .reverse()
                  .map((conv) => (
                    <ConversationItem
                      selected={conv === activeConversation}
                      conv={conv}
                      setMessages={setMessages}
                      setActiveConversation={setActiveConversation}
                      setShowHistory={setShowHistory}
                      disabled={waitingForReply}
                    />
                  ))
              )}
            </div>
          </div>
        ) : null}

        <div className={styles.chatContent}>
          {viewMode === "chat" && (
            <div className={styles.conversationTitleBar}>
              <button
                type="button"
                className={styles.backButton}
                onClick={handleBackToStartup}
                aria-label="Back to conversations"
                title="Back to conversations"
              >
                <ChevronDownIcon
                  width="0.85em"
                  height="0.85em"
                  style={{ transform: "rotate(90deg)" }}
                  aria-hidden
                />
                <span>All Chats</span>
              </button>

              <div className={styles.conversationTitleDivider} />

              {renameInput === null ? (
                <button
                  type="button"
                  className={styles.conversationTitleTrigger}
                  onClick={() => {
                    if (activeConversation) {
                      setRenameInput(activeConversation.title ?? "");
                    }
                  }}
                  disabled={!activeConversation}
                >
                  <span className={styles.conversationTitleText}>
                    {activeConversation?.title || "New Conversation"}
                  </span>
                  {activeConversation && (
                    <PencilIcon
                      className={styles.conversationTitlePencil}
                      width="0.85em"
                      height="0.85em"
                    />
                  )}
                </button>
              ) : (
                <div className={styles.conversationTitleInputContainer}>
                  <input
                    ref={renameInputRef}
                    type="text"
                    placeholder="Conversation name"
                    className={styles.conversationTitleInput}
                    autoFocus
                    autoComplete="off"
                    value={renameInput}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setRenameInput(null)}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                  />
                  <IconButton
                    label="Confirm"
                    onClick={confirmRename}
                    onPointerDown={(e) => e.preventDefault()}
                  >
                    <CheckIcon width="1em" height="1em" />
                  </IconButton>
                  <IconButton
                    label="Cancel"
                    onClick={() => renameInputRef.current?.blur()}
                    onPointerDown={(e) => e.preventDefault()}
                  >
                    <CrossIcon width="1em" height="1em" />
                  </IconButton>
                </div>
              )}
            </div>
          )}

          {viewMode === "startup" ? (
            !hasAnyApiKey ? (
              <ChatEntryPage
                openAiApiKey={openAiApiKey}
                setOpenAiApiKey={setOpenAiApiKey}
                claudeApiKey={claudeApiKey}
                setClaudeApiKey={setClaudeApiKey}
                chatHistory={chatHistory}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={(conv) => setConversationToDelete(conv)}
                waitingForReply={waitingForReply}
                scrollRef={messagesRef}
                onScroll={handleScroll}
              />
            ) : (
              <div
                className={styles.messages}
                ref={messagesRef}
                onScroll={handleScroll}
              >
                <div className={styles.emptyChatContainer}>
                  <button
                    type="button"
                    className={styles.newChatOption}
                    onClick={handleOpenNewChatPage}
                    disabled={waitingForReply}
                    aria-label="Start new conversation"
                  >
                    <div className={styles.newChatIconContainer}>
                      <PlusIcon width="1.1em" height="1.1em" aria-hidden />
                    </div>
                    <div className={styles.newChatTextContainer}>
                      <span className={styles.newChatTitle}>
                        New Conversation
                      </span>
                      <span className={styles.newChatSubtitle}>
                        Start a fresh chat with the assistant
                      </span>
                    </div>
                  </button>

                  <div className={styles.pastConversationsSection}>
                    <div className={styles.pastConversationsHeader}>
                      <span className={styles.pastConversationsTitle}>
                        Past Conversations
                      </span>
                      {chatHistory.length > 0 && (
                        <span className={styles.pastConversationsCount}>
                          {chatHistory.length}
                        </span>
                      )}
                    </div>

                    {chatHistory.length === 0 ? (
                      <div className={styles.emptyHistoryPlaceholder}>
                        <span className={styles.emptyHistoryTitle}>
                          No past conversations yet
                        </span>
                        <span className={styles.emptyHistoryHint}>
                          Click New Conversation above to start a chat.
                        </span>
                      </div>
                    ) : (
                      <div className={styles.pastConversationsList}>
                        {chatHistory
                          .slice()
                          .reverse()
                          .map((conv) => (
                            <PastConversationCard
                              key={conv.id}
                              conv={conv}
                              onSelect={() => handleSelectConversation(conv)}
                              onDelete={() => setConversationToDelete(conv)}
                              disabled={waitingForReply}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : messages.length === 0 ? (
            <div
              className={styles.newChatCenterWrapper}
              ref={messagesRef}
              onScroll={handleScroll}
            >
              <div className={styles.newChatEmptyState}>
                <div className={styles.newChatEmptyIcon}>
                  <RobotIcon width="2.2em" height="2.2em" />
                </div>
                <h3 className={styles.newChatEmptyTitle}>New Conversation</h3>
                <p className={styles.newChatEmptySubtitle}>
                  Type a message below to begin chatting with the assistant.
                </p>
                <div className={styles.newChatInputContainer}>
                  {renderInputRow(true)}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                className={styles.messages}
                ref={messagesRef}
                onScroll={handleScroll}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      styles.message +
                      " " +
                      (m.role === "user"
                        ? styles.messageUser
                        : styles.messageLlm)
                    }
                  >
                    <div
                      data-testid="chat-message"
                      className={clsx(
                        styles.messageBubble,
                        m.thinking && styles.thinkingBubble,
                        m.isError && styles.errorBubble,
                      )}
                    >
                      {m.executedTools &&
                        m.executedTools.length > 0 &&
                        (() => {
                          const totalRounds = Math.max(
                            ...m.executedTools.map((t) => t.turn ?? 1),
                          );
                          return (
                            <div className={styles.toolActionList}>
                              {m.executedTools.length > 1 && (
                                <div className={styles.toolActionsSummary}>
                                  <span>
                                    {m.executedTools.length} actions executed
                                    across {totalRounds}{" "}
                                    {totalRounds === 1 ? "round" : "rounds"}
                                  </span>
                                </div>
                              )}
                              {m.executedTools.map((tool, idx) => {
                                const isSuccess = tool.result.success !== false;
                                const stepNum = tool.step ?? idx + 1;
                                const hasArguments =
                                  tool.arguments &&
                                  Object.keys(tool.arguments).length > 0;
                                const hasData = tool.result.data !== undefined;

                                return (
                                  <div
                                    key={tool.id || `${tool.name}-${idx}`}
                                    className={clsx(
                                      styles.toolActionCard,
                                      !isSuccess && styles.toolActionCardError,
                                    )}
                                  >
                                    <div className={styles.toolActionHeader}>
                                      <span className={styles.stepBadge}>
                                        Step {stepNum}
                                      </span>
                                      {tool.turn && tool.turn > 1 && (
                                        <span className={styles.turnBadge}>
                                          Round {tool.turn}
                                        </span>
                                      )}
                                      <span className={styles.toolActionName}>
                                        {tool.name}
                                      </span>
                                      <span
                                        className={clsx(
                                          styles.statusBadge,
                                          isSuccess
                                            ? styles.statusSuccess
                                            : styles.statusError,
                                        )}
                                      >
                                        {isSuccess ? "Success" : "Failed"}
                                      </span>
                                    </div>
                                    <div className={styles.toolActionMessage}>
                                      {tool.result.message}
                                    </div>
                                    {(hasArguments || hasData) && (
                                      <details className={styles.toolDetails}>
                                        <summary
                                          className={styles.toolDetailsSummary}
                                        >
                                          View Parameters & Output
                                        </summary>
                                        <div className={styles.toolDetailsBody}>
                                          {hasArguments && (
                                            <div>
                                              <div
                                                className={
                                                  styles.toolSectionLabel
                                                }
                                              >
                                                Input Parameters
                                              </div>
                                              <pre
                                                className={styles.toolCodeBlock}
                                              >
                                                {JSON.stringify(
                                                  tool.arguments,
                                                  null,
                                                  2,
                                                )}
                                              </pre>
                                            </div>
                                          )}
                                          {hasData && (
                                            <div>
                                              <div
                                                className={
                                                  styles.toolSectionLabel
                                                }
                                              >
                                                Returned Data
                                              </div>
                                              <pre
                                                className={styles.toolCodeBlock}
                                              >
                                                {JSON.stringify(
                                                  tool.result.data,
                                                  null,
                                                  2,
                                                )}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      {m.committedActions && m.committedActions.length > 0 && (
                        <div className={styles.committedActionsList}>
                          {m.committedActions.map((action) => {
                            const canRevert =
                              action.status === "committed" &&
                              Boolean(action.revertData);
                            const canReapply = action.status === "reverted";
                            const isReverting = revertingActionId === action.id;

                            return (
                              <div
                                key={action.id}
                                className={clsx(
                                  styles.committedActionCard,
                                  action.status === "committed" &&
                                    styles.actionStatusCommitted,
                                  action.status === "discarded" &&
                                    styles.actionStatusDiscarded,
                                  action.status === "reverted" &&
                                    styles.actionStatusReverted,
                                )}
                              >
                                <div className={styles.committedActionHeader}>
                                  <span className={styles.committedActionTitle}>
                                    {action.status === "committed"
                                      ? "Committed Action"
                                      : action.status === "reverted"
                                        ? "Reverted Action"
                                        : "Discarded Action"}
                                  </span>
                                  <span
                                    className={styles.committedActionToolName}
                                  >
                                    {action.toolName}
                                  </span>
                                  <span
                                    className={clsx(
                                      styles.actionStatusBadge,
                                      action.status === "committed" &&
                                        styles.badgeCommitted,
                                      action.status === "discarded" &&
                                        styles.badgeDiscarded,
                                      action.status === "reverted" &&
                                        styles.badgeReverted,
                                    )}
                                  >
                                    {action.status === "committed"
                                      ? "Committed"
                                      : action.status === "reverted"
                                        ? "Reverted"
                                        : "Discarded"}
                                  </span>
                                </div>
                                <p
                                  className={styles.committedActionDescription}
                                >
                                  {action.description}
                                </p>
                                {action.changes &&
                                  action.changes.length > 0 && (
                                    <div className={styles.changeTable}>
                                      <div className={styles.changeTableHeader}>
                                        <span>Property</span>
                                        <span>Current</span>
                                        <span></span>
                                        <span>Proposed</span>
                                      </div>
                                      {action.changes.map((c, idx) => (
                                        <div
                                          key={idx}
                                          className={styles.changeTableRow}
                                        >
                                          <span className={styles.changeField}>
                                            {c.field}
                                          </span>
                                          <span
                                            className={styles.changeCurrent}
                                          >
                                            {c.currentValue}
                                          </span>
                                          <span className={styles.changeArrow}>
                                            -&gt;
                                          </span>
                                          <span
                                            className={styles.changeProposed}
                                          >
                                            {c.proposedValue}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                {action.consequences &&
                                  action.consequences.length > 0 && (
                                    <div
                                      className={styles.consequencesContainer}
                                    >
                                      <span
                                        className={styles.consequencesLabel}
                                      >
                                        Expected Effects:
                                      </span>
                                      <ul className={styles.consequencesList}>
                                        {action.consequences.map((eff, i) => (
                                          <li key={i}>{eff}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                {action.arguments &&
                                  Object.keys(action.arguments).length > 0 && (
                                    <details
                                      className={styles.confirmationDetails}
                                    >
                                      <summary>View Raw Parameters</summary>
                                      <pre className={styles.toolCodeBlock}>
                                        {JSON.stringify(
                                          action.arguments,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </details>
                                  )}
                                {(canRevert || canReapply) && (
                                  <div className={styles.committedActionFooter}>
                                    {canRevert && (
                                      <button
                                        type="button"
                                        className={styles.revertButton}
                                        disabled={isReverting}
                                        onClick={() =>
                                          handleRevertAction(m.id, action.id)
                                        }
                                      >
                                        {isReverting
                                          ? "Reverting..."
                                          : "Revert Change"}
                                      </button>
                                    )}
                                    {canReapply && (
                                      <button
                                        type="button"
                                        className={styles.reapplyButton}
                                        disabled={isReverting}
                                        onClick={() =>
                                          handleReapplyAction(m.id, action.id)
                                        }
                                      >
                                        {isReverting
                                          ? "Applying..."
                                          : "Re-apply Change"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {m.thinking ? (
                        <div className={styles.thinkingWrapper}>
                          <div className={styles.thinkingContainer}>
                            <PulseLoader size="8px" spacing="6px" />
                            <span className={styles.thinkingStatusText}>
                              {m.statusText || "Thinking..."}
                            </span>
                          </div>
                          {pendingConfirmation && (
                            <div className={styles.confirmationCard}>
                              <div className={styles.confirmationHeader}>
                                <span className={styles.confirmationTitle}>
                                  Commit Workbench Change
                                </span>
                                <span className={styles.confirmationToolName}>
                                  {pendingConfirmation.request.toolName}
                                </span>
                              </div>
                              <div className={styles.confirmationBody}>
                                <p className={styles.confirmationDescription}>
                                  {pendingConfirmation.request.description}
                                </p>
                                {pendingConfirmation.request.changes &&
                                  pendingConfirmation.request.changes.length >
                                    0 && (
                                    <div className={styles.changeTable}>
                                      <div className={styles.changeTableHeader}>
                                        <span>Property</span>
                                        <span>Current</span>
                                        <span></span>
                                        <span>Proposed</span>
                                      </div>
                                      {pendingConfirmation.request.changes.map(
                                        (c, idx) => (
                                          <div
                                            key={idx}
                                            className={styles.changeTableRow}
                                          >
                                            <span
                                              className={styles.changeField}
                                            >
                                              {c.field}
                                            </span>
                                            <span
                                              className={styles.changeCurrent}
                                            >
                                              {c.currentValue}
                                            </span>
                                            <span
                                              className={styles.changeArrow}
                                            >
                                              -&gt;
                                            </span>
                                            <span
                                              className={styles.changeProposed}
                                            >
                                              {c.proposedValue}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                {pendingConfirmation.request.consequences &&
                                  pendingConfirmation.request.consequences
                                    .length > 0 && (
                                    <div
                                      className={styles.consequencesContainer}
                                    >
                                      <span
                                        className={styles.consequencesLabel}
                                      >
                                        Expected Effects:
                                      </span>
                                      <ul className={styles.consequencesList}>
                                        {pendingConfirmation.request.consequences.map(
                                          (eff, i) => (
                                            <li key={i}>{eff}</li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                {pendingConfirmation.request.arguments &&
                                  Object.keys(
                                    pendingConfirmation.request.arguments,
                                  ).length > 0 && (
                                    <details
                                      className={styles.confirmationDetails}
                                    >
                                      <summary>View Raw Parameters</summary>
                                      <pre className={styles.toolCodeBlock}>
                                        {JSON.stringify(
                                          pendingConfirmation.request.arguments,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </details>
                                  )}
                              </div>
                              <div className={styles.confirmationActions}>
                                <button
                                  className={styles.rejectButton}
                                  onClick={() =>
                                    handleResolveConfirmation(false)
                                  }
                                >
                                  Discard
                                </button>
                                <button
                                  className={styles.approveButton}
                                  onClick={() =>
                                    handleResolveConfirmation(true)
                                  }
                                >
                                  Commit Change
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : m.role === "llm" ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[
                            [
                              rehypeSanitize,
                              {
                                ...defaultSchema,
                                attributes: {
                                  ...defaultSchema.attributes,
                                  div: [
                                    ...(defaultSchema.attributes?.div || []),
                                    ["className", "math", "math-display"],
                                  ],
                                  span: [
                                    ...(defaultSchema.attributes?.span || []),
                                    ["className", "math", "math-inline"],
                                  ],
                                  code: [
                                    ...(defaultSchema.attributes?.code || []),
                                    "className",
                                  ],
                                },
                              },
                            ],
                            [rehypeKatex, { output: "mathml" }],
                          ]}
                          components={{
                            code({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }: any) {
                              const codeText = String(children).replace(
                                /\n$/,
                                "",
                              );

                              const language =
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                /language-(\w+)/.exec(className || "")?.[1] ??
                                "";

                              // Only render code block wrapper for triple-backtick code (has language or contains newlines)
                              const isCodeBlock =
                                language || codeText.includes("\n");

                              return inline || !isCodeBlock ? (
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                <code {...props} className={className}>
                                  {children}
                                </code>
                              ) : (
                                <div className={styles.codeBlockWrapper}>
                                  <div className={styles.codeBlockHeader}>
                                    <div className={styles.codeBlockTitle}>
                                      Code Block
                                      {language ? ` (${language})` : ""}
                                    </div>
                                    <button
                                      className={styles.copyButton}
                                      onClick={() => {
                                        void navigator.clipboard?.writeText(
                                          codeText,
                                        );
                                      }}
                                      aria-label="Copy code"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <div
                                    className={styles.codeBlockContentWrapper}
                                  >
                                    <code {...props}>{children}</code>
                                  </div>
                                </div>
                              );
                            },
                            // @ts-expect-error: math is not in Components type
                            math: function MathComponent({
                              node,
                              className,
                              children,
                              ...props
                            }: any) {
                              const rawLatex = extractRawLatexFromHast(node);

                              const mathEl = (
                                // @ts-expect-error: math is not in JSX types
                                <math
                                  {...props}
                                  className={clsx(
                                    className as string,
                                    styles.mathEquation,
                                  )}
                                  data-testid="latex-math"
                                >
                                  {children}
                                  {/* @ts-expect-error: math is not in JSX types */}
                                </math>
                              );

                              return rawLatex ? (
                                <ContextMenu.Root>
                                  <ContextMenu.Trigger asChild>
                                    <span
                                      className={styles.mathContextMenuTrigger}
                                    >
                                      <Tooltip text="Right-click for options">
                                        {mathEl}
                                      </Tooltip>
                                    </span>
                                  </ContextMenu.Trigger>
                                  <ContextMenu.Portal>
                                    <ContextMenu.Content
                                      className={styles.contextMenuContent}
                                    >
                                      <ContextMenu.Item
                                        className={styles.contextMenuItem}
                                        onSelect={() => {
                                          void navigator.clipboard?.writeText(
                                            rawLatex,
                                          );
                                        }}
                                      >
                                        Copy formula
                                      </ContextMenu.Item>
                                    </ContextMenu.Content>
                                  </ContextMenu.Portal>
                                </ContextMenu.Root>
                              ) : (
                                mathEl
                              );
                            },
                          }}
                        >
                          {m.text}
                        </ReactMarkdown>
                      ) : (
                        <div className={styles.plainText}>{m.text}</div>
                      )}
                      {showDebugDetails && m.debugInfo && (
                        <div className={styles.debugContainer}>
                          <details className={styles.debugDetails}>
                            <summary className={styles.debugSummary}>
                              <span className={styles.debugSummaryTitle}>
                                Debug & Execution Details
                              </span>
                              <span className={styles.debugBadge}>
                                {m.debugInfo.model}
                              </span>
                              <span className={styles.debugBadge}>
                                {m.debugInfo.provider}
                              </span>
                              <span className={styles.debugBadge}>
                                {m.debugInfo.totalTurns}{" "}
                                {m.debugInfo.totalTurns === 1
                                  ? "round"
                                  : "rounds"}
                              </span>
                              <span className={styles.debugBadge}>
                                {m.debugInfo.totalSteps}{" "}
                                {m.debugInfo.totalSteps === 1
                                  ? "action"
                                  : "actions"}
                              </span>
                              {m.debugInfo.durationMs !== undefined && (
                                <span className={styles.debugBadge}>
                                  {(m.debugInfo.durationMs / 1000).toFixed(2)}s
                                </span>
                              )}
                            </summary>
                            <div className={styles.debugBody}>
                              <details className={styles.debugSubDetails} open>
                                <summary className={styles.debugSubSummary}>
                                  <span>Assembled System Prompt & Context</span>
                                  <button
                                    type="button"
                                    className={styles.debugCopyBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void navigator.clipboard?.writeText(
                                        m.debugInfo!.systemPrompt,
                                      );
                                    }}
                                  >
                                    Copy Prompt
                                  </button>
                                </summary>
                                <pre className={styles.debugCodeBlock}>
                                  {m.debugInfo.systemPrompt}
                                </pre>
                              </details>

                              {m.debugInfo.turns &&
                                m.debugInfo.turns.length > 0 && (
                                  <details
                                    className={styles.debugSubDetails}
                                    open
                                  >
                                    <summary className={styles.debugSubSummary}>
                                      <span>
                                        Multi-Turn Execution Log (
                                        {m.debugInfo.turns.length} rounds)
                                      </span>
                                    </summary>
                                    <div className={styles.turnList}>
                                      {m.debugInfo.turns.map((turn) => (
                                        <div
                                          key={turn.turn}
                                          className={styles.turnCard}
                                        >
                                          <div className={styles.turnHeader}>
                                            <span className={styles.stepBadge}>
                                              Round {turn.turn}
                                            </span>
                                            <span
                                              className={styles.turnSummaryText}
                                            >
                                              {turn.modelResponse.toolCalls
                                                .length > 0
                                                ? `${turn.modelResponse.toolCalls.length} tool call(s) requested`
                                                : "Direct text response"}
                                            </span>
                                          </div>
                                          {turn.modelResponse.text && (
                                            <div className={styles.turnSection}>
                                              <div
                                                className={
                                                  styles.turnSectionLabel
                                                }
                                              >
                                                Model Output:
                                              </div>
                                              <div
                                                className={
                                                  styles.turnSectionText
                                                }
                                              >
                                                {turn.modelResponse.text}
                                              </div>
                                            </div>
                                          )}
                                          {turn.modelResponse.toolCalls.length >
                                            0 && (
                                            <div className={styles.turnSection}>
                                              <div
                                                className={
                                                  styles.turnSectionLabel
                                                }
                                              >
                                                Requested Tool Invocations:
                                              </div>
                                              {turn.modelResponse.toolCalls.map(
                                                (call) => (
                                                  <div
                                                    key={call.id}
                                                    className={
                                                      styles.toolCallItem
                                                    }
                                                  >
                                                    <div
                                                      className={
                                                        styles.toolCallName
                                                      }
                                                    >
                                                      <code>{call.name}</code>{" "}
                                                      <span
                                                        className={
                                                          styles.toolCallId
                                                        }
                                                      >
                                                        ({call.id})
                                                      </span>
                                                    </div>
                                                    <pre
                                                      className={
                                                        styles.debugCodeBlock
                                                      }
                                                    >
                                                      {JSON.stringify(
                                                        call.arguments,
                                                        null,
                                                        2,
                                                      )}
                                                    </pre>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          )}
                                          {turn.toolExecutions &&
                                            turn.toolExecutions.length > 0 && (
                                              <div
                                                className={styles.turnSection}
                                              >
                                                <div
                                                  className={
                                                    styles.turnSectionLabel
                                                  }
                                                >
                                                  Tool Execution Observations:
                                                </div>
                                                {turn.toolExecutions.map(
                                                  (exec) => (
                                                    <div
                                                      key={exec.id}
                                                      className={
                                                        styles.toolExecItem
                                                      }
                                                    >
                                                      <div
                                                        className={
                                                          styles.toolExecHeader
                                                        }
                                                      >
                                                        <span
                                                          className={
                                                            styles.stepBadge
                                                          }
                                                        >
                                                          Step {exec.step}
                                                        </span>
                                                        <code>{exec.name}</code>
                                                        <span
                                                          className={clsx(
                                                            styles.statusBadge,
                                                            exec.result.success
                                                              ? styles.statusSuccess
                                                              : styles.statusError,
                                                          )}
                                                        >
                                                          {exec.result.success
                                                            ? "Success"
                                                            : "Failed"}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={
                                                          styles.toolExecMessage
                                                        }
                                                      >
                                                        {exec.result.message}
                                                      </div>
                                                      {exec.result.data !==
                                                        undefined && (
                                                        <pre
                                                          className={
                                                            styles.debugCodeBlock
                                                          }
                                                        >
                                                          {JSON.stringify(
                                                            exec.result.data,
                                                            null,
                                                            2,
                                                          )}
                                                        </pre>
                                                      )}
                                                      {exec.result.error && (
                                                        <div
                                                          className={
                                                            styles.toolExecError
                                                          }
                                                        >
                                                          {exec.result.error}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            )}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}

                              {m.debugInfo.initialMessages &&
                                m.debugInfo.initialMessages.length > 0 && (
                                  <details className={styles.debugSubDetails}>
                                    <summary className={styles.debugSubSummary}>
                                      <span>
                                        Initial Conversation Input (
                                        {m.debugInfo.initialMessages.length}{" "}
                                        messages)
                                      </span>
                                    </summary>
                                    <pre className={styles.debugCodeBlock}>
                                      {JSON.stringify(
                                        m.debugInfo.initialMessages,
                                        null,
                                        2,
                                      )}
                                    </pre>
                                  </details>
                                )}

                              <details className={styles.debugSubDetails}>
                                <summary className={styles.debugSubSummary}>
                                  <span>Raw Diagnostics JSON</span>
                                  <button
                                    type="button"
                                    className={styles.debugCopyBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void navigator.clipboard?.writeText(
                                        JSON.stringify(m.debugInfo, null, 2),
                                      );
                                    }}
                                  >
                                    Copy JSON
                                  </button>
                                </summary>
                                <pre className={styles.debugCodeBlock}>
                                  {JSON.stringify(m.debugInfo, null, 2)}
                                </pre>
                              </details>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {renderInputRow(false)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
