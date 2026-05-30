import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

export function OfflineBanner({
  visible,
  pendingCount = 0,
  failedCount = 0,
  replayMessage,
  isReplaying = false,
  onRetryReplay
}: {
  visible: boolean;
  pendingCount?: number;
  failedCount?: number;
  replayMessage?: string | null;
  isReplaying?: boolean;
  onRetryReplay?: () => void;
}) {
  if (!visible && pendingCount === 0 && failedCount === 0 && !replayMessage) {
    return null;
  }

  const waitingCount = pendingCount + failedCount;

  return (
    <View style={styles.banner}>
      <Ionicons name={visible ? "cloud-offline" : "time"} size={18} color={colors.ink} />
      <View style={styles.copy}>
        <Text style={styles.text}>
          {visible
            ? waitingCount > 0
              ? `Not connected to the local backend - ${waitingCount} queued change${waitingCount === 1 ? "" : "s"} waiting to replay.`
              : "Not connected to the local backend - new saves for supported actions will queue locally."
            : waitingCount > 0
              ? `${waitingCount} queued change${waitingCount === 1 ? "" : "s"} waiting to replay when the backend is reachable.`
              : "Queued changes will replay on the next successful backend refresh."}
        </Text>
        {failedCount > 0 ? (
          <Text style={styles.meta}>{failedCount} queued change{failedCount === 1 ? "" : "s"} failed last replay.</Text>
        ) : null}
        {replayMessage ? <Text style={styles.meta}>{replayMessage}</Text> : null}
        {isReplaying ? <Text style={styles.meta}>Replaying queued changes...</Text> : null}
      </View>
      {onRetryReplay && waitingCount > 0 && !isReplaying ? (
        <Pressable onPress={onRetryReplay} style={styles.retryButton}>
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  text: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  retryButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  retryLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  }
});
