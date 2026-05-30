import type { RealtimeSyncStatus, SyncSource } from "../types";
import { describeLiveUpdateSync } from "../services/familyRealtimeSync";

export function getSyncPillLabel(syncSource: SyncSource): string {
  return syncSource === "api" ? "Household synced" : "Local preview";
}

export function getSyncPillTone(syncSource: SyncSource): "primary" | "neutral" {
  return syncSource === "api" ? "primary" : "neutral";
}

/** Short status for tab screens - avoids repeating long hydrate counts. */
export function getSyncStatusLine(input: {
  syncSource: SyncSource;
  isHydrating: boolean;
  realtimeStatus?: RealtimeSyncStatus;
  realtimeMessage?: string;
}): string {
  if (input.isHydrating) {
    return "Refreshing household data...";
  }

  if (input.syncSource !== "api") {
    return "Preview data only. Connect the backend to save for the whole family.";
  }

  if (input.realtimeStatus === "connected") {
    return "Live updates on. Other devices refresh through the server.";
  }

  if (input.realtimeStatus === "connecting") {
    return input.realtimeMessage || "Connecting live updates...";
  }

  if (input.realtimeStatus === "error" && input.realtimeMessage) {
    return input.realtimeMessage;
  }

  return "Refresh anytime. Live updates need Supabase Realtime on core tables.";
}

export function getLiveUpdateNote(input: {
  syncSource: SyncSource;
  realtimeStatus: RealtimeSyncStatus;
  realtimeMessage: string;
}): string {
  return describeLiveUpdateSync(input);
}
