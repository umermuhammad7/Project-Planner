import type { RealtimeSyncStatus, SyncSource } from "../types";

export function getSyncPillLabel(syncSource: SyncSource): string {
  return syncSource === "api" ? "Household synced" : "On this device";
}

export function getSyncPillTone(syncSource: SyncSource): "primary" | "neutral" {
  return syncSource === "api" ? "primary" : "neutral";
}

/** Short status for tab screens - avoids repeating long hydrate counts. */
export function getSyncStatusLine(input: {
  syncSource: SyncSource;
  isHydrating: boolean;
  syncMessage?: string;
  realtimeStatus?: RealtimeSyncStatus;
  realtimeMessage?: string;
}): string {
  if (input.isHydrating) {
    return "Refreshing household data...";
  }

  if (input.syncSource !== "api") {
    const message = input.syncMessage?.trim();
    if (message && !/preview household on this device|preview data on this device/i.test(message)) {
      return message;
    }

    return "Preview data on this device. Sign in to share with your household.";
  }

  if (input.realtimeStatus === "connected") {
    return "Live updates on. Changes from other devices appear automatically.";
  }

  if (input.realtimeStatus === "connecting") {
    return input.realtimeMessage || "Connecting live updates...";
  }

  if (input.realtimeStatus === "error" && input.realtimeMessage) {
    return input.realtimeMessage;
  }

  return "Pull to refresh anytime for the latest household data.";
}

export function getLiveUpdateNote(input: {
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
