import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  postgresHandlers,
  subscribeCallbacks,
  removeChannelMock,
  channelMock,
  channelFactory
} = vi.hoisted(() => {
  const postgresHandlers: Array<{
    config: Record<string, unknown>;
    callback: () => void;
  }> = [];
  const subscribeCallbacks: Array<(status: string, err?: Error) => void> = [];
  const removeChannelMock = vi.fn(async () => undefined);
  const channelMock = {
    on: vi.fn((_event: string, config: Record<string, unknown>, callback: () => void) => {
      postgresHandlers.push({ config, callback });
      return channelMock;
    }),
    subscribe: vi.fn((callback: (status: string, err?: Error) => void) => {
      subscribeCallbacks.push(callback);
      return channelMock;
    })
  };
  const channelFactory = vi.fn(() => channelMock);

  return {
    postgresHandlers,
    subscribeCallbacks,
    removeChannelMock,
    channelMock,
    channelFactory
  };
});

vi.mock("../../mobile/src/services/supabase.js", () => ({
  isSupabaseConfigured: true,
  supabaseClient: {
    channel: channelFactory,
    removeChannel: removeChannelMock
  }
}));

import {
  __resetFamilyRealtimeSyncForTests,
  describeLiveUpdateSync,
  startFamilyRealtimeSync,
  stopFamilyRealtimeSync
} from "../../mobile/src/services/familyRealtimeSync.js";

describe("family realtime sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    postgresHandlers.length = 0;
    subscribeCallbacks.length = 0;
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
    channelFactory.mockClear();
    removeChannelMock.mockClear();
    __resetFamilyRealtimeSyncForTests();
  });

  afterEach(() => {
    __resetFamilyRealtimeSyncForTests();
    vi.useRealTimers();
  });

  it("reports unavailable when sync is disabled", () => {
    const onStatus = vi.fn();

    startFamilyRealtimeSync({
      familyId: "family-1",
      listIds: ["list-1"],
      enabled: false,
      onStatus,
      onRefreshRequested: vi.fn()
    });

    expect(onStatus).toHaveBeenCalledWith(
      "unavailable",
      "Live updates require Supabase sign-in, a family membership, and backend sync."
    );
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("subscribes to family-scoped tables and debounces refresh requests", () => {
    const onStatus = vi.fn();
    const onRefreshRequested = vi.fn();

    startFamilyRealtimeSync({
      familyId: "family-1",
      listIds: ["list-a", "list-b"],
      enabled: true,
      onStatus,
      onRefreshRequested
    });

    expect(channelFactory).toHaveBeenCalledWith("family-family-1");
    expect(onStatus).toHaveBeenCalledWith("connecting", "Connecting live household updates...");

    const tables = postgresHandlers.map((handler) => handler.config.table);
    expect(tables).toEqual(["events", "chores", "lists", "list_items"]);

    const listItemsBinding = postgresHandlers.find((handler) => handler.config.table === "list_items");
    expect(listItemsBinding?.config.filter).toBe("list_id=in.(list-a,list-b)");

    postgresHandlers[0]?.callback();
    postgresHandlers[0]?.callback();
    expect(onRefreshRequested).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(onRefreshRequested).toHaveBeenCalledTimes(1);
  });

  it("updates status when the channel subscribes or errors", () => {
    const onStatus = vi.fn();

    startFamilyRealtimeSync({
      familyId: "family-1",
      listIds: [],
      enabled: true,
      onStatus,
      onRefreshRequested: vi.fn()
    });

    subscribeCallbacks[0]?.("SUBSCRIBED");
    expect(onStatus).toHaveBeenCalledWith(
      "connected",
      "Live updates connected. Remote changes refresh events, chores, and lists from the server."
    );

    subscribeCallbacks[0]?.("CHANNEL_ERROR", new Error("publication missing"));
    expect(onStatus).toHaveBeenCalledWith("error", "publication missing");
  });

  it("cleans up the active channel on stop", () => {
    startFamilyRealtimeSync({
      familyId: "family-1",
      listIds: ["list-1"],
      enabled: true,
      onStatus: vi.fn(),
      onRefreshRequested: vi.fn()
    });

    stopFamilyRealtimeSync();
    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
  });

  it("describes live update messaging honestly by sync state", () => {
    expect(
      describeLiveUpdateSync({
        syncSource: "mock",
        realtimeStatus: "inactive",
        realtimeMessage: ""
      })
    ).toContain("Connect to the local backend");

    expect(
      describeLiveUpdateSync({
        syncSource: "api",
        realtimeStatus: "connected",
        realtimeMessage: "Live updates connected."
      })
    ).toContain("Live updates are on");

    expect(
      describeLiveUpdateSync({
        syncSource: "api",
        realtimeStatus: "unavailable",
        realtimeMessage: "Need Supabase sign-in."
      })
    ).toBe("Need Supabase sign-in.");
  });
});
