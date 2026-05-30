import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("../../mobile/src/services/api.js", () => ({
  apiRequest: apiRequestMock
}));

vi.mock("../../mobile/src/services/offlineQueueStorage.js", () => {
  let queue: unknown[] = [];
  return {
    loadOfflineQueueFromStorage: () => queue,
    saveOfflineQueueToStorage: (items: unknown[]) => {
      queue = items;
    },
    clearOfflineQueueStorage: () => {
      queue = [];
    }
  };
});

import {
  clearOfflineQueue,
  enqueueOfflineItem,
  getOfflineQueue,
  replayOfflineQueue
} from "../../mobile/src/services/offlineQueue.js";

describe("offline queue replay", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    clearOfflineQueue();
  });

  it("queues and replays create_event mutations", async () => {
    enqueueOfflineItem({
      familyId: "family-1",
      type: "create_event",
      summary: "Create event: Soccer",
      payload: {
        title: "Soccer",
        description: null,
        location: null,
        startAt: "2026-06-01T16:00:00.000Z",
        endAt: "2026-06-01T17:00:00.000Z",
        allDay: false,
        memberIds: []
      }
    });

    apiRequestMock.mockResolvedValueOnce({ data: { event: { id: "event-1" } } });

    const result = await replayOfflineQueue({
      familyId: "family-1",
      listContext: {
        familyId: "family-1",
        groceryListId: null,
        lists: [],
        ensureList: async () => null
      }
    });

    expect(result).toEqual({ replayed: 1, failed: 0, remaining: 0 });
    expect(getOfflineQueue()).toEqual([]);
    expect(apiRequestMock).toHaveBeenCalledWith("/families/family-1/events", expect.objectContaining({ method: "POST" }));
  });

  it("skips duplicate replays only after success and marks failures honestly", async () => {
    enqueueOfflineItem({
      familyId: "family-1",
      type: "create_chore",
      summary: "Create chore: Dishes",
      payload: {
        title: "Dishes",
        description: null,
        icon: null,
        starsValue: 2,
        assignedTo: null,
        recurrenceRule: null,
        dueTime: null,
        isActive: true
      }
    });

    apiRequestMock.mockResolvedValueOnce({ error: { message: "Server down", code: "NETWORK_ERROR" } });

    const result = await replayOfflineQueue({
      familyId: "family-1",
      listContext: {
        familyId: "family-1",
        groceryListId: null,
        lists: [],
        ensureList: async () => null
      }
    });

    expect(result).toEqual({ replayed: 0, failed: 1, remaining: 1 });
    expect(getOfflineQueue()[0]?.status).toBe("failed");
    expect(getOfflineQueue()[0]?.lastError).toBe("Server down");
  });
});
