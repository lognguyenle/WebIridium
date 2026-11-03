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
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "openai" },
  { id: "gpt-5.4", name: "GPT-5.4", provider: "openai" },
  { id: "gpt-5.4-pro", name: "GPT-5.4 Pro", provider: "openai" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano", provider: "openai" },
  { id: "gpt-5.2", name: "GPT-5.2", provider: "openai" },
  { id: "gpt-5.1", name: "GPT-5.1", provider: "openai" },
  { id: "gpt-5", name: "GPT-5", provider: "openai" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
  { id: "o4-mini", name: "o4-mini", provider: "openai" },
  { id: "o3-mini", name: "o3-mini", provider: "openai" },
  { id: "o1", name: "o1", provider: "openai" },

  // Anthropic
  { id: "claude-haiku-5-5", name: "Claude 5.5 Haiku", provider: "anthropic" },
  { id: "claude-sonnet-5-5", name: "Claude 5.5 Sonnet", provider: "anthropic" },
  { id: "claude-opus-5-5", name: "Claude 5.5 Opus", provider: "anthropic" },
  { id: "claude-fable-5-1", name: "Claude 5.1 Fable", provider: "anthropic" },
  { id: "claude-sonnet-4-6", name: "Claude 4.6 Sonnet", provider: "anthropic" },
  { id: "claude-opus-4-6", name: "Claude 4.6 Opus", provider: "anthropic" },
];

export const modelAtom = atom<string>("gpt-5.4-mini");

export type ChatRole = "user" | "llm";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
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

// Legacy migration logic

const DATABASE_NAME = "testing_database4";
const DATABASE_VERSION = 1;
const MAIN_STORE_NAME = "main";
const MAIN_KEY_NAME = "main";

interface LegacySavedData {
  workspace: {
    chatHistory?: ChatConversation[];
    chatSystemPrompt?: string | null;
    apiKey?: string | null;
  };
}

const requestSavedDataForMigration = (): Promise<LegacySavedData | null> => {
  return new Promise((resolve) => {
    if (typeof window.indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onerror = () => resolve(null);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.close();
      resolve(null);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      try {
        const transaction = db.transaction([MAIN_STORE_NAME], "readonly");
        const getRequest = transaction
          .objectStore(MAIN_STORE_NAME)
          .get(MAIN_KEY_NAME);

        getRequest.onsuccess = () => {
          resolve(getRequest.result as LegacySavedData);
        };
        getRequest.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
  });
};

const MIGRATION_KEY = "chat_migration_v1_complete";

export const migrateFromLegacyDbAtom = atom(null, async (_get, set) => {
  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
  if (alreadyMigrated) {
    console.log("Chat data already migrated, skipping.");
    return;
  }

  console.log("Starting chat data migration from legacy DB...");
  try {
    const data = await requestSavedDataForMigration();
    if (data && data.workspace) {
      if (data.workspace.apiKey) {
        set(openAiApiKeyAtom, data.workspace.apiKey);
      }
      if (data.workspace.chatSystemPrompt) {
        set(systemPromptAtom, data.workspace.chatSystemPrompt);
      }
      if (data.workspace.chatHistory) {
        set(_chatHistoryAtom, data.workspace.chatHistory);
      }
      console.log("Chat data migration successful.");
    }
    localStorage.setItem(MIGRATION_KEY, "true");
  } catch (e) {
    console.error("Failed to migrate legacy chat data", e);
  }
});

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
