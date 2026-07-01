import { StyleSheet, Text, View } from "react-native";

import { Pill } from "./Primitives";
import { colors, spacing } from "../constants/theme";
import { RealtimeSyncStatus, SyncSource } from "../types";
import { getLiveUpdateNote, getSyncPillLabel, getSyncPillTone, getSyncStatusLine } from "../utils/syncTrustCopy";

type SyncStatusRowProps = {
  syncSource: SyncSource;
  syncMessage?: string;
  isHydrating: boolean;
  realtimeStatus?: RealtimeSyncStatus;
  realtimeMessage?: string;
  showLiveNote?: boolean;
};

export function SyncStatusRow({
  syncSource,
  syncMessage,
  isHydrating,
  realtimeStatus = "inactive",
  realtimeMessage = "",
  showLiveNote = false
}: SyncStatusRowProps) {
  const statusLine = getSyncStatusLine({
    syncSource,
    syncMessage,
    isHydrating,
    realtimeStatus,
    realtimeMessage
  });
  const liveNote =
    showLiveNote && syncSource === "api"
      ? getLiveUpdateNote({ syncSource, realtimeStatus, realtimeMessage })
      : null;

  return (
    <View style={styles.wrap}>
      {liveNote ? <Text style={styles.liveNote}>{liveNote}</Text> : null}
      <View style={styles.row}>
        <Pill
          label={getSyncPillLabel(syncSource)}
          tone={getSyncPillTone(syncSource)}
          icon={syncSource === "api" ? "sparkles" : "information-circle"}
        />
        <Text style={styles.statusLine}>{statusLine}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.sm
  },
  liveNote: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  statusLine: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  }
});
