import { apiRequest, type ApiResult } from "./api";
import {
  clearOfflineQueueStorage,
  loadOfflineQueueFromStorage,
  saveOfflineQueueToStorage
} from "./offlineQueueStorage";
import {
  OfflineQueueItem,
  OfflineQueueCreateChorePayload,
  OfflineQueueCreateEventPayload,
  OfflineQueueCreateListItemPayload
} from "../types";

const MAX_QUEUE_ITEMS = 50;

export function getOfflineQueue(): OfflineQueueItem[] {
  return loadOfflineQueueFromStorage();
}

export function setOfflineQueue(queue: OfflineQueueItem[]) {
  saveOfflineQueueToStorage(queue.slice(0, MAX_QUEUE_ITEMS));
}

export function enqueueOfflineItem(
  item: Omit<OfflineQueueItem, "id" | "createdAt" | "status" | "lastError">
): OfflineQueueItem {
  const entry: OfflineQueueItem = {
    ...item,
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    lastError: null
  };

  const nextQueue = [entry, ...getOfflineQueue()].slice(0, MAX_QUEUE_ITEMS);
  setOfflineQueue(nextQueue);
  return entry;
}

export function markOfflineItemFailed(id: string, message: string) {
  setOfflineQueue(
    getOfflineQueue().map((item) =>
      item.id === id
        ? {
            ...item,
            status: "failed",
            lastError: message
          }
        : item
    )
  );
}

export function removeOfflineItem(id: string) {
  setOfflineQueue(getOfflineQueue().filter((item) => item.id !== id));
}

export function clearOfflineQueue() {
  clearOfflineQueueStorage();
}

export function isRetryableApiError(result: ApiResult<unknown>) {
  return result.error?.code === "NETWORK_ERROR";
}

type ReplayListContext = {
  familyId: string;
  groceryListId: string | null;
  lists: Array<{ id: string; type: string }>;
  ensureList: (input: {
    listId?: string | null;
    listTitle?: string;
    listType?: string;
  }) => Promise<string | null>;
};

export async function replayOfflineItem(
  item: OfflineQueueItem,
  listContext: ReplayListContext
): Promise<{ ok: boolean; error?: string }> {
  if (item.familyId !== listContext.familyId) {
    return { ok: false, error: "Queued change belongs to a different family." };
  }

  if (item.type === "create_event") {
    const payload = item.payload as OfflineQueueCreateEventPayload;
    const result = await apiRequest<{ event: { id: string } }>(
      `/families/${item.familyId}/events`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );

    if (!result.data?.event) {
      return { ok: false, error: result.error?.message ?? "Failed to replay event." };
    }

    return { ok: true };
  }

  if (item.type === "create_chore") {
    const payload = item.payload as OfflineQueueCreateChorePayload;
    const result = await apiRequest<{ chore: { id: string } }>(
      `/families/${item.familyId}/chores`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );

    if (!result.data?.chore) {
      return { ok: false, error: result.error?.message ?? "Failed to replay chore." };
    }

    return { ok: true };
  }

  if (item.type === "create_list_item") {
    const payload = item.payload as OfflineQueueCreateListItemPayload;
    const listId = await listContext.ensureList({
      listId: payload.listId,
      listTitle: payload.listTitle,
      listType: payload.listType
    });

    if (!listId) {
      return { ok: false, error: "Could not resolve a list for the queued item." };
    }

    const result = await apiRequest<{ item: { id: string } }>(
      `/families/${item.familyId}/lists/${listId}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          content: payload.content,
          category: payload.category
        })
      }
    );

    if (!result.data?.item) {
      return { ok: false, error: result.error?.message ?? "Failed to replay list item." };
    }

    return { ok: true };
  }

  return { ok: false, error: "Unsupported queued mutation type." };
}

export async function replayOfflineQueue(input: {
  familyId: string;
  listContext: ReplayListContext;
}) {
  const queue = getOfflineQueue().filter((item) => item.familyId === input.familyId);
  let replayed = 0;
  let failed = 0;

  for (const item of queue) {
    const result = await replayOfflineItem(item, input.listContext);
    if (result.ok) {
      removeOfflineItem(item.id);
      replayed += 1;
      continue;
    }

    markOfflineItemFailed(item.id, result.error ?? "Replay failed.");
    failed += 1;
  }

  return {
    replayed,
    failed,
    remaining: getOfflineQueue().filter((item) => item.familyId === input.familyId).length
  };
}
