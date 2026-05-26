import Ionicons from "@expo/vector-icons/Ionicons";
import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing } from "../constants/theme";
import { FamilyMember } from "../types";

type IconName = keyof typeof Ionicons.glyphMap;

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Row({
  children,
  align = "center"
}: PropsWithChildren<{ align?: "center" | "flex-start" }>) {
  return <View style={[styles.row, { alignItems: align }]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function Pill({
  label,
  tone = "neutral",
  icon
}: {
  label: string;
  tone?: "neutral" | "primary" | "mint" | "coral" | "gold";
  icon?: IconName;
}) {
  return (
    <View style={[styles.pill, styles[`${tone}Pill`]]}>
      {icon ? <Ionicons name={icon} size={14} color={toneColor(tone)} /> : null}
      <Text style={[styles.pillText, { color: toneColor(tone) }]}>{label}</Text>
    </View>
  );
}

export function MemberAvatar({ member, size = 38 }: { member: FamilyMember; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: member.color }]}>
      <Text style={styles.avatarText}>{member.initials}</Text>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  selected
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconButton, selected && styles.iconButtonSelected]}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.muted} />
      <Text style={[styles.iconButtonText, selected && styles.iconButtonTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  tone = "primary"
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "primary" | "dark";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.primaryButton, tone === "dark" && styles.darkButton]}
    >
      {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function toneColor(tone: "neutral" | "primary" | "mint" | "coral" | "gold") {
  if (tone === "primary") return colors.primary;
  if (tone === "mint") return colors.mint;
  if (tone === "coral") return colors.coral;
  if (tone === "gold") return "#996A00";
  return colors.muted;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow.card
  },
  row: {
    flexDirection: "row",
    gap: spacing.md
  },
  sectionTitle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.xl
  },
  sectionText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  sectionAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800"
  },
  pill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  neutralPill: {
    backgroundColor: "#F1ECE5"
  },
  primaryPill: {
    backgroundColor: colors.primarySoft
  },
  mintPill: {
    backgroundColor: colors.mintSoft
  },
  coralPill: {
    backgroundColor: colors.coralSoft
  },
  goldPill: {
    backgroundColor: colors.goldSoft
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800"
  },
  avatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center"
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  iconButton: {
    alignItems: "center",
    borderRadius: radii.md,
    flex: 1,
    gap: 3,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 4
  },
  iconButtonSelected: {
    backgroundColor: colors.primarySoft
  },
  iconButtonText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  iconButtonTextSelected: {
    color: colors.primary
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg
  },
  darkButton: {
    backgroundColor: colors.ink
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  }
});
