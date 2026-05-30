import { OfflineQueueItem } from "../types";

const STORAGE_KEY = "homethread-offline-queue";
const memoryQueue: OfflineQueueItem[] = [];

export function loadOfflineQueueFromStorage(): OfflineQueueItem[] {
  if (typeof localStorage === "undefined") {
    return [...memoryQueue];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isOfflineQueueItem);
  } catch {
    return [];
  }
}

export function saveOfflineQueueToStorage(queue: OfflineQueueItem[]) {
  if (typeof localStorage === "undefined") {
    memoryQueue.splice(0, memoryQueue.length, ...queue);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueueStorage() {
  saveOfflineQueueToStorage([]);
}

function isOfflineQueueItem(value: unknown): value is OfflineQueueItem {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<OfflineQueueItem>;
  return (
    typeof item.id === "string" &&
    typeof item.familyId === "string" &&
    (item.type === "create_event" ||
      item.type === "create_chore" ||
      item.type === "create_list_item") &&
    typeof item.summary === "string" &&
    typeof item.createdAt === "string" &&
    (item.status === "pending" || item.status === "failed")
  );
}
