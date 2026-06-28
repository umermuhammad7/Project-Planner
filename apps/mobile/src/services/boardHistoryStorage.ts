import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { TextUpdate } from "../types";

export const BOARD_HISTORY_MAX_ENTRIES = 100;

function storageKey(familyId: string) {
  return `homethread-board-history:${familyId}`;
}

function isTextUpdate(value: unknown): value is TextUpdate {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<TextUpdate>;
  return (
    typeof item.id === "string" &&
    (item.direction === "inbound" || item.direction === "outbound") &&
    typeof item.author === "string" &&
    typeof item.body === "string" &&
    typeof item.createdAt === "string"
  );
}

function parseBoardHistoryPayload(raw: string | null): TextUpdate[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTextUpdate).slice(0, BOARD_HISTORY_MAX_ENTRIES);
  } catch {
    return [];
  }
}

function trimBoardHistory(updates: TextUpdate[]): TextUpdate[] {
  return updates.slice(0, BOARD_HISTORY_MAX_ENTRIES);
}

function useWebLocalStorage() {
  return Platform.OS === "web" && typeof localStorage !== "undefined";
}

function loadBoardHistoryFromWebStorage(familyId: string): TextUpdate[] {
  return parseBoardHistoryPayload(localStorage.getItem(storageKey(familyId)));
}

function saveBoardHistoryToWebStorage(familyId: string, updates: TextUpdate[]) {
  localStorage.setItem(storageKey(familyId), JSON.stringify(trimBoardHistory(updates)));
}

export async function loadBoardHistoryFromStorage(familyId: string | null): Promise<TextUpdate[]> {
  if (!familyId) {
    return [];
  }

  if (useWebLocalStorage()) {
    return loadBoardHistoryFromWebStorage(familyId);
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(familyId));
    return parseBoardHistoryPayload(raw);
  } catch {
    return [];
  }
}

export async function saveBoardHistoryToStorage(familyId: string | null, updates: TextUpdate[]) {
  if (!familyId) {
    return;
  }

  const trimmed = trimBoardHistory(updates);

  if (useWebLocalStorage()) {
    saveBoardHistoryToWebStorage(familyId, trimmed);
    return;
  }

  try {
    await AsyncStorage.setItem(storageKey(familyId), JSON.stringify(trimmed));
  } catch {
    // Board history is best-effort on device; do not block planner flows.
  }
}

export async function clearBoardHistoryStorage(familyId: string | null) {
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
