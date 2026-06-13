import Ionicons from "@expo/vector-icons/Ionicons";
import { PropsWithChildren, useRef } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
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
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => animatePress(scale, 0.96)}
        onPressOut={() => animatePress(scale, 1)}
        style={({ pressed }) => [
          styles.iconButton,
          selected && styles.iconButtonSelected,
          pressed && styles.iconButtonPressed
        ]}
      >
        <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.muted} />
        <Text style={[styles.iconButtonText, selected && styles.iconButtonTextSelected]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  tone = "primary",
  loading = false,
  disabled = false
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "primary" | "dark" | "soft" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconColor = buttonForeground(tone);
  const isDisabled = disabled || loading;

  return (
    <Animated.View style={{ alignSelf: "stretch", transform: [{ scale }], opacity: isDisabled ? 0.72 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => {
          if (!isDisabled) {
            animatePress(scale, 0.97);
          }
        }}
        onPressOut={() => animatePress(scale, 1)}
        style={({ pressed }) => [
          styles.primaryButton,
          tone === "dark" && styles.darkButton,
          tone === "soft" && styles.softButton,
          tone === "ghost" && styles.ghostButton,
          pressed && !isDisabled && styles[pressedToneStyleName(tone)]
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : icon ? (
          <Ionicons name={icon} size={18} color={iconColor} />
        ) : null}
        <Text style={[styles.primaryButtonText, { color: iconColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function toneColor(tone: "neutral" | "primary" | "mint" | "coral" | "gold") {
  if (tone === "primary") return colors.primary;
  if (tone === "mint") return colors.mint;
  if (tone === "coral") return colors.coral;
  if (tone === "gold") return "#996A00";
  return colors.muted;
}

function buttonForeground(tone: "primary" | "dark" | "soft" | "ghost") {
  if (tone === "soft") return colors.primary;
  if (tone === "ghost") return colors.ink;
  return "#FFFFFF";
}

function pressedToneStyleName(tone: "primary" | "dark" | "soft" | "ghost") {
  if (tone === "dark") return "darkButtonPressed";
  if (tone === "soft") return "softButtonPressed";
  if (tone === "ghost") return "ghostButtonPressed";
  return "primaryButtonPressed";
}

function animatePress(scale: Animated.Value, toValue: number) {
  Animated.spring(scale, {
    toValue,
    useNativeDriver: Platform.OS !== "web",
    stiffness: 240,
    damping: 24,
    mass: 1
  }).start();
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    maxWidth: "100%",
    minWidth: 0,
    padding: spacing.md,
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
    marginBottom: 12,
    marginTop: spacing.lg
  },
  sectionText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: "700"
  },
  sectionAction: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700"
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
    backgroundColor: colors.surfaceRaised
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
    fontWeight: "700"
  },
  avatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderColor: "rgba(255,255,255,0.9)",
    borderWidth: 2,
    justifyContent: "center"
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  iconButton: {
    alignItems: "center",
    borderRadius: radii.lg,
    flex: 1,
    gap: 3,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 7
  },
  iconButtonSelected: {
    backgroundColor: colors.primarySoft
  },
  iconButtonPressed: {
    opacity: 0.84
  },
  iconButtonText: {
    color: colors.tertiary,
    fontSize: 10,
    fontWeight: "700"
  },
  iconButtonTextSelected: {
    color: colors.primary
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
    opacity: 0.96
  },
  darkButton: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  darkButtonPressed: {
    backgroundColor: "#1F190F",
    opacity: 0.96
  },
  softButton: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.18)",
    shadowOpacity: 0.03
  },
  softButtonPressed: {
    backgroundColor: "#E9D8C5",
    opacity: 0.98
  },
  ghostButton: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    shadowOpacity: 0.02
  },
  ghostButtonPressed: {
    backgroundColor: "#F5EFE7",
    opacity: 0.98
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700"
  }
});
