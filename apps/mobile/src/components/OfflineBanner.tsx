import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline" size={18} color={colors.ink} />
      <Text style={styles.text}>Offline changes will sync when your connection returns.</Text>
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
