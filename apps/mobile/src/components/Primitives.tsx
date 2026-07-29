import Ionicons from "@expo/vector-icons/Ionicons";
import { PropsWithChildren, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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

export function FieldError({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.fieldError}>{message}</Text>;
}

export function ConceptStrip({
  title,
  body,
  tone = "neutral"
}: {
  title: string;
  body: string;
  tone?: "neutral" | "primary" | "mint";
}) {
  return (
    <View style={[styles.conceptStrip, styles[`${tone}ConceptStrip`]]}>
      <Text style={styles.conceptTitle}>{title}</Text>
      <Text style={styles.conceptBody}>{body}</Text>
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
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = Boolean(member.avatarUrl) && !imageFailed;

  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: member.color }]}>
      {showPhoto ? (
        <Image
          accessibilityLabel={`${member.name} profile photo`}
          onError={() => setImageFailed(true)}
          source={{ uri: member.avatarUrl!, cache: "reload" }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{member.initials}</Text>
      )}
    </View>
  );
}

export type ModuleTileTone = "gold" | "mint" | "primary";

const moduleTileToneStyles = StyleSheet.create({
  gold: { backgroundColor: "rgba(214, 168, 74, 0.16)" },
  mint: { backgroundColor: "rgba(95, 168, 136, 0.14)" },
  primary: { backgroundColor: colors.primarySoft }
});

const moduleTileToneColors: Record<ModuleTileTone, string> = {
  gold: "#996A00",
  mint: colors.mint,
  primary: colors.primary
};

// Tap-to-expand tile used to reveal/hide a card of content below it — same
// interaction as Household's widget tiles, shared here since it's now used
// identically across multiple screens (Kids Mode session, Child Device shell).
export function ModuleTile({
  emoji,
  tone,
  label,
  meta,
  active,
  onPress
}: {
  emoji: string;
  tone: ModuleTileTone;
  label: string;
  meta: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      accessibilityLabel={`${label}. ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleTile,
        moduleTileToneStyles[tone],
        active && { borderColor: moduleTileToneColors[tone], borderWidth: 2 },
        pressed && !active && styles.moduleTilePressed
      ]}
    >
      <View
        style={[
          styles.moduleTileIconBadge,
          active ? { backgroundColor: moduleTileToneColors[tone] } : styles.moduleTileIconBadgeIdle
        ]}
      >
        <Text style={styles.moduleTileEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.moduleTileLabel, active && { color: moduleTileToneColors[tone] }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.moduleTileMeta} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

type IconButtonTone = "primary" | "mint" | "coral" | "gold" | "sky";

const iconButtonToneColors: Record<IconButtonTone, string> = {
  primary: colors.primary,
  mint: colors.mint,
  coral: colors.coral,
  gold: colors.gold,
  sky: colors.sky
};

const iconButtonToneSoft: Record<IconButtonTone, string> = {
  primary: colors.primarySoft,
  mint: colors.mintSoft,
  coral: colors.coralSoft,
  gold: colors.goldSoft,
  sky: colors.skySoft
};

export function IconButton({
  icon,
  label,
  onPress,
  selected,
  tone = "primary"
}: {
  icon: string;
  label: string;
  onPress: () => void;
  selected?: boolean;
  tone?: IconButtonTone;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const toneColor = iconButtonToneColors[tone];

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
          selected && { backgroundColor: iconButtonToneSoft[tone] },
          pressed && styles.iconButtonPressed
        ]}
      >
        <Text style={styles.iconButtonGlyph}>{icon}</Text>
        <Text
          style={[styles.iconButtonText, selected && { color: toneColor, fontWeight: "800" }]}
          numberOfLines={1}
        >
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
  tone?: "primary" | "dark" | "soft" | "ghost" | "mint" | "sky";
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
          tone === "mint" && styles.mintButton,
          tone === "sky" && styles.skyButton,
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

function buttonForeground(tone: "primary" | "dark" | "soft" | "ghost" | "mint" | "sky") {
  if (tone === "soft") return colors.primary;
  if (tone === "ghost") return colors.ink;
  if (tone === "mint") return colors.mint;
  if (tone === "sky") return colors.sky;
  return "#FFFFFF";
}

function pressedToneStyleName(tone: "primary" | "dark" | "soft" | "ghost" | "mint" | "sky") {
  if (tone === "dark") return "darkButtonPressed";
  if (tone === "soft") return "softButtonPressed";
  if (tone === "ghost") return "ghostButtonPressed";
  if (tone === "mint") return "mintButtonPressed";
  if (tone === "sky") return "skyButtonPressed";
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
    marginBottom: spacing.sm,
    marginTop: spacing.md
  },
  sectionText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  sectionAction: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: "48%",
    textAlign: "right"
  },
  fieldError: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.xs
  },
  conceptStrip: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  neutralConceptStrip: {
    backgroundColor: colors.canvas,
    borderColor: colors.line
  },
  primaryConceptStrip: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.16)"
  },
  mintConceptStrip: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.16)"
  },
  conceptTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  conceptBody: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
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
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  moduleTile: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radii.lg,
    borderWidth: 2,
    flex: 1,
    gap: 3,
    minHeight: 76,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  moduleTilePressed: {
    opacity: 0.85
  },
  moduleTileIconBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    marginBottom: 2,
    width: 32
  },
  moduleTileIconBadgeIdle: {
    backgroundColor: colors.surface
  },
  moduleTileEmoji: {
    fontSize: 16,
    lineHeight: 19
  },
  moduleTileLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2
  },
  moduleTileMeta: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "600"
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
  iconButtonGlyph: {
    fontSize: 20,
    lineHeight: 24
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
  mintButton: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.24)",
    shadowOpacity: 0.03
  },
  mintButtonPressed: {
    backgroundColor: "#D9E6D4",
    opacity: 0.98
  },
  skyButton: {
    backgroundColor: colors.skySoft,
    borderColor: "rgba(107,127,173,0.24)",
    shadowOpacity: 0.03
  },
  skyButtonPressed: {
    backgroundColor: "#D7DEEC",
    opacity: 0.98
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700"
  }
});
