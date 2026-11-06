import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
  AgentDebugInfo,
  CommittedActionRecord,
} from "@/features/chat/harness/types";

// TODO: Put all the settings under one chat settings object

export const openAiApiKeyAtom = atomWithStorage<string | null>(
  "chat_apiKey",
  null,
);
export const claudeApiKeyAtom = atomWithStorage<string | null>(
  "chat_claudeApiKey",
  null,
);

export const DEFAULT_SYSTEM_PROMPT =
  "You are a systems biologist assistant that specializes in a biological compound and reaction modeling language named Antimony that is based off of SBML, help the user debug and analyze their models that are written in Antimony";

export const MASTER_PROMPT =
  "You should always use LaTeX for math equations. You can use inline math like $E=mc^2$ or block math like $$E=mc^2$$.";

export const systemPromptAtom = atomWithStorage<string>(
  "chat_systemPrompt",
  DEFAULT_SYSTEM_PROMPT,
);

export const confirmToolActionsAtom = atomWithStorage<boolean>(
  "chat_confirmToolActions",
  true,
);

export const showDebugDetailsAtom = atomWithStorage<boolean>(
  "chat_showDebugDetails",
  true,
);

export const AVAILABLE_MODELS = [
  // OpenAI
  { id: "gpt-6.1-terra", name: "GPT-6.1 Terra ($$$$$)", provider: "openai" },
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol ($$$$$)", provider: "openai" },
  { id: "gpt-6-sol", name: "GPT-6 Sol ($$$$)", provider: "openai" },
  { id: "gpt-6-luna", name: "GPT-6 Luna ($$$$)", provider: "openai" },
  { id: "gpt-6-astra", name: "GPT-6 Astra ($$$$)", provider: "openai" },
  { id: "gpt-5.5", name: "GPT-5.5 ($$$)", provider: "openai" },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini ($)", provider: "openai" },
  { id: "o4-mini", name: "o4-mini ($$)", provider: "openai" },

  // Anthropic
  {
    id: "claude-haiku-5-5",
    name: "Claude 5.5 Haiku ($)",
    provider: "anthropic",
  },
  {
    id: "claude-fable-5-1",
    name: "Claude 5.1 Fable ($$)",
    provider: "anthropic",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude 4.6 Sonnet ($$$)",
    provider: "anthropic",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude 5.5 Sonnet ($$$)",
    provider: "anthropic",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude 4.6 Opus ($$$$)",
    provider: "anthropic",
  },
  {
    id: "claude-opus-5-5",
    name: "Claude 5.5 Opus ($$$$$)",
    provider: "anthropic",
  },
];

export const modelAtom = atom<string>("gpt-5.4-mini");

export type ChatRole = "user" | "llm";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp?: number;
  isError?: boolean;
  statusText?: string;
  executedTools?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
    result: {
      success: boolean;
      message: string;
      data?: unknown;
      error?: string;
    };
    turn?: number;
    step?: number;
  }>;
  committedActions?: CommittedActionRecord[];
  debugInfo?: AgentDebugInfo;
}

export interface ChatConversation {
  id: string;
  title?: string;
  messages: ChatMessage[];
  unixTimestampMs: number;
}

const MAX_CHAT_HISTORY = 100;

const _chatHistoryAtom = atomWithStorage<ChatConversation[]>(
  "chat_history",
  [],
);

export const updateAllChatHistoryAtom = atom(
  null,
  (_get, set, history: ChatConversation[]) => {
    set(_chatHistoryAtom, history);
  },
);

export const deleteConversationAtom = atom(
  null,
  (get, set, conversationId: string) => {
    const history = get(_chatHistoryAtom);
    const active = get(activeConversationAtom);
    set(
      _chatHistoryAtom,
      history.filter((c) => c.id !== conversationId),
    );
    if (active?.id === conversationId) {
      set(activeConversationAtom, null);
    }
  },
);

export const chatHistoryAtom = atom((get) => get(_chatHistoryAtom));

// Active conversation selected for loading into the chat panel
export const activeConversationAtom = atom<ChatConversation | null>(null);

export const upsertActiveConversationAtom = atom(
  null,
  (
    get,
    set,
    { messages, title }: { messages: ChatMessage[]; title?: string },
  ) => {
    const history = get(_chatHistoryAtom);
    const active = get(activeConversationAtom);

    if (active) {
      // update existing conversation in place
      const updated: ChatConversation = {
        ...active,
        messages,
        title: title ?? active.title,
      };

      const newHistory = history.map((c) => (c.id === active.id ? updated : c));
      set(_chatHistoryAtom, newHistory);
      set(activeConversationAtom, updated);
    } else {
      // create new conversation
      const record: ChatConversation = {
        id: String(Date.now()),
        title: title ?? `Conversation `,
        messages,
        unixTimestampMs: Date.now(),
      };

      const remaining =
        history.length >= MAX_CHAT_HISTORY ? history.slice(1) : history;
      const newHistory = [...remaining, record];
      set(_chatHistoryAtom, newHistory);
      set(activeConversationAtom, record);
    }
  },
);
