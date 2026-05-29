import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

export function OfflineBanner({
  visible,
  pendingCount = 0
}: {
  visible: boolean;
  pendingCount?: number;
}) {
  if (!visible && pendingCount === 0) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline" size={18} color={colors.ink} />
      <Text style={styles.text}>
        {visible
          ? pendingCount > 0
            ? `Not connected to the local backend - ${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.`
            : "Not connected to the local backend - changes may not sync."
          : `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync when the backend is back.`}
      </Text>
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
  text: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  }
});
