import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

export function OfflineBanner({
  pendingCount = 0,
  failedCount = 0,
  replayMessage,
  isReplaying = false,
  onRetryReplay
}: {
  pendingCount?: number;
  failedCount?: number;
  replayMessage?: string | null;
  isReplaying?: boolean;
  onRetryReplay?: () => void;
}) {
  const waitingCount = pendingCount + failedCount;

  if (waitingCount === 0 && !replayMessage && !isReplaying) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="time" size={18} color={colors.ink} />
      <View style={styles.copy}>
        <Text style={styles.text}>
          {waitingCount > 0
            ? `${waitingCount} change${waitingCount === 1 ? "" : "s"} waiting to sync when the server is reachable again.`
            : "Queued changes will sync on the next successful refresh."}
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
