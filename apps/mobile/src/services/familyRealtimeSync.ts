import type { RealtimeChannel } from "@supabase/supabase-js";

import type { RealtimeSyncStatus, SyncSource } from "../types";
import { isSupabaseConfigured, supabaseClient } from "./supabase";

export type StartFamilyRealtimeSyncInput = {
  familyId: string;
  listIds: string[];
  enabled: boolean;
  onStatus: (status: RealtimeSyncStatus, message: string) => void;
  onRefreshRequested: () => void;
};

const REALTIME_TABLES_WITH_FAMILY_ID = ["events", "chores", "lists"] as const;
const DEBOUNCE_MS = 400;

let channel: RealtimeChannel | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionKey: string | null = null;

function buildListItemsFilter(listIds: string[]): string | null {
  if (listIds.length === 0) {
    return null;
  }

  if (listIds.length === 1) {
    return `list_id=eq.${listIds[0]}`;
  }

  return `list_id=in.(${listIds.join(",")})`;
}

function scheduleRefresh(onRefreshRequested: () => void) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    onRefreshRequested();
  }, DEBOUNCE_MS);
}

export function stopFamilyRealtimeSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (channel && supabaseClient) {
    void supabaseClient.removeChannel(channel);
  }

  channel = null;
  subscriptionKey = null;
}

export function startFamilyRealtimeSync(input: StartFamilyRealtimeSyncInput) {
  if (!isSupabaseConfigured || !supabaseClient) {
    stopFamilyRealtimeSync();
    input.onStatus("unavailable", "Live updates need sign-in configured in this build.");
    return;
  }

  if (!input.enabled || !input.familyId) {
    stopFamilyRealtimeSync();
    input.onStatus(
      "unavailable",
      "Live updates need a signed-in household with server sync enabled."
    );
    return;
  }

  const nextKey = `${input.familyId}:${input.listIds.slice().sort().join(",")}`;
  if (subscriptionKey === nextKey && channel) {
    return;
  }

  stopFamilyRealtimeSync();
  subscriptionKey = nextKey;
  input.onStatus("connecting", "Connecting live household updates...");

  const client = supabaseClient;
  const nextChannel = client.channel(`family-${input.familyId}`);

  for (const table of REALTIME_TABLES_WITH_FAMILY_ID) {
    nextChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `family_id=eq.${input.familyId}`
      },
      () => {
        scheduleRefresh(input.onRefreshRequested);
      }
    );
  }

  const listItemsFilter = buildListItemsFilter(input.listIds);
  if (listItemsFilter) {
    nextChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "list_items",
        filter: listItemsFilter
      },
      () => {
        scheduleRefresh(input.onRefreshRequested);
      }
    );
  }

  nextChannel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      input.onStatus(
        "connected",
        "Live updates connected. Remote changes refresh events, chores, and lists from the server."
      );
      return;
    }

    if (status === "CHANNEL_ERROR") {
      input.onStatus(
        "error",
        "Live updates could not connect. Pull to refresh for the latest household data."
      );
      return;
    }

    if (status === "TIMED_OUT") {
      input.onStatus("error", "Live update connection timed out. Use Refresh to catch up.");
      return;
    }

    if (status === "CLOSED") {
      input.onStatus("inactive", "Live updates disconnected.");
    }
  });

  channel = nextChannel;
}

export function __resetFamilyRealtimeSyncForTests() {
  stopFamilyRealtimeSync();
}

export function describeLiveUpdateSync(input: {
  syncSource: SyncSource;
  realtimeStatus: RealtimeSyncStatus;
  realtimeMessage: string;
}): string {
  if (input.syncSource !== "api") {
    return "Sign in to sync household data across devices.";
  }

  if (input.realtimeStatus === "connected") {
    return "Live updates are on. When another device changes events, chores, or lists, this app refreshes from the server automatically.";
  }

  if (input.realtimeStatus === "connecting") {
    return input.realtimeMessage || "Connecting live updates...";
  }

  return (
    input.realtimeMessage ||
    "Live updates unavailable. Pull to refresh for the latest household data."
  );
}
