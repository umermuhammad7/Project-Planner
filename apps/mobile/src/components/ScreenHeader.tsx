import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, spacing } from "../constants/theme";
import { Pill } from "./Primitives";

type IconName = keyof typeof Ionicons.glyphMap;

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  badgeLabel,
  badgeTone = "neutral",
  actionLabel,
  actionIcon = "chevron-back",
  onActionPress,
  variant = "daily",
  density = "default"
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: IconName;
  badgeLabel?: string;
  badgeTone?: "neutral" | "primary" | "mint" | "coral" | "gold";
  actionLabel?: string;
  actionIcon?: IconName;
  onActionPress?: () => void;
  variant?: "daily" | "admin";
  density?: "default" | "compact";
}) {
  const isAdmin = variant === "admin";
  const isCompact = density === "compact";

  return (
    <View style={[styles.header, isAdmin && styles.headerAdmin, isCompact && styles.headerCompact]}>
      <View style={styles.copy}>
        <View style={styles.topRow}>
          {eyebrow ? <Text style={[styles.eyebrow, isAdmin && styles.eyebrowAdmin]}>{eyebrow}</Text> : null}
          {badgeLabel ? <Pill label={badgeLabel} tone={badgeTone} /> : null}
        </View>
        <Text style={[styles.title, isAdmin && styles.titleAdmin, isCompact && styles.titleCompact]}>{title}</Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={[styles.subtitle, isAdmin && styles.subtitleAdmin, isCompact && styles.subtitleCompact]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onActionPress ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onActionPress}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
        >
          <Ionicons color={colors.primary} name={actionIcon} size={18} />
          <Text style={styles.actionLabel}>{actionLabel ?? "Back"}</Text>
        </Pressable>
      ) : icon ? (
        <View style={[styles.iconBadge, isAdmin && styles.iconBadgeAdmin, isCompact && styles.iconBadgeCompact]}>
          <Ionicons color={isAdmin ? colors.muted : colors.primary} name={icon} size={isCompact ? 20 : 22} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginBottom: spacing.lg
  },
  headerAdmin: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  headerCompact: {
    marginBottom: spacing.md
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  eyebrowAdmin: {
    color: colors.muted
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38
  },
  titleAdmin: {
    fontSize: 28,
    lineHeight: 34
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 34
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  subtitleAdmin: {
    fontSize: 14,
    lineHeight: 20
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.18)",
    borderRadius: radii.xl,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    marginTop: spacing.xs,
    width: 52
  },
  iconBadgeAdmin: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong
  },
  iconBadgeCompact: {
    height: 46,
    width: 46
  },
  actionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  actionButtonPressed: {
    backgroundColor: colors.canvas,
    opacity: 0.92
  },
  actionLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  }
});
