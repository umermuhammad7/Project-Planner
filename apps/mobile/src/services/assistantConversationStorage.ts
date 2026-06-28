import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type StoredAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
};

export const ASSISTANT_WELCOME_MESSAGE: StoredAssistantMessage = {
  id: "assistant-welcome",
  role: "assistant",
  body: "Paste family text or ask for help. I'll draft it - you save what fits."
};

export const ASSISTANT_CONVERSATION_MAX_ENTRIES = 80;

function storageKey(familyId: string) {
  return `homethread-assistant-thread:${familyId}`;
}

function isStoredAssistantMessage(value: unknown): value is StoredAssistantMessage {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<StoredAssistantMessage>;
  return (
    typeof item.id === "string" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.body === "string"
  );
}

function parseConversationPayload(raw: string | null): StoredAssistantMessage[] {
  if (!raw) {
    return [ASSISTANT_WELCOME_MESSAGE];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [ASSISTANT_WELCOME_MESSAGE];
    }

    const messages = parsed.filter(isStoredAssistantMessage).slice(-ASSISTANT_CONVERSATION_MAX_ENTRIES);
    return messages.length > 0 ? messages : [ASSISTANT_WELCOME_MESSAGE];
  } catch {
    return [ASSISTANT_WELCOME_MESSAGE];
  }
}

function trimConversation(messages: StoredAssistantMessage[]): StoredAssistantMessage[] {
  return messages.slice(-ASSISTANT_CONVERSATION_MAX_ENTRIES);
}

function useWebLocalStorage() {
  return Platform.OS === "web" && typeof localStorage !== "undefined";
}

export async function loadAssistantConversationFromStorage(
  familyId: string | null
): Promise<StoredAssistantMessage[]> {
  if (!familyId) {
    return [ASSISTANT_WELCOME_MESSAGE];
  }

  if (useWebLocalStorage()) {
    return parseConversationPayload(localStorage.getItem(storageKey(familyId)));
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(familyId));
    return parseConversationPayload(raw);
  } catch {
    return [ASSISTANT_WELCOME_MESSAGE];
  }
}

export async function saveAssistantConversationToStorage(
  familyId: string | null,
  messages: StoredAssistantMessage[]
) {
  if (!familyId) {
    return;
  }

  const trimmed = trimConversation(messages);

  if (useWebLocalStorage()) {
    localStorage.setItem(storageKey(familyId), JSON.stringify(trimmed));
    return;
  }

  try {
    await AsyncStorage.setItem(storageKey(familyId), JSON.stringify(trimmed));
  } catch {
    // Device-local assistant history is best-effort.
  }
}

export async function clearAssistantConversationStorage(familyId: string | null) {
  if (!familyId) {
    return;
  }

  if (useWebLocalStorage()) {
    localStorage.removeItem(storageKey(familyId));
    return;
  }

  try {
    await AsyncStorage.removeItem(storageKey(familyId));
  } catch {
    // Ignore clear failures.
  }
}
