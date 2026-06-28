import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Pill, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MoreDestination } from "../types";

type MoreLink = {
  key: MoreDestination;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "mint" | "gold" | "coral";
  meta?: string;
};

export function MoreScreen({
  onOpen,
  onOpenFamilySettings,
  onOpenInsights,
  onOpenSettings
}: {
  onOpen: (destination: MoreDestination) => void;
  onOpenFamilySettings?: () => void;
  onOpenInsights?: () => void;
  onOpenSettings?: () => void;
}) {
  const meals = useHomeThreadStore((state) => state.meals);
  const textUpdates = useHomeThreadStore((state) => state.textUpdates);
  const members = useHomeThreadStore((state) => state.members);
  const kidCount = members.filter((member) => member.role === "kid").length;

  const links: MoreLink[] = [
    {
      key: "assistant",
      title: "Assistant",
      subtitle: "Draft plans, meals, and lists. You approve every save.",
      icon: "sparkles",
      tone: "primary"
    },
    {
      key: "meals",
      title: "Meals",
      subtitle: "Plan the week and keep recipes handy.",
      icon: "restaurant",
      tone: "coral",
      meta: meals.length > 0 ? `${meals.length} planned` : "Open week plan"
    },
    {
      key: "board",
      title: "Family board",
      subtitle: "Post household updates or import a family text.",
      icon: "chatbubbles",
      tone: "mint",
      meta: textUpdates.length > 0 ? `${textUpdates.length} on board` : "Share an update"
    }
  ];

  return (
    <View>
      <ScreenHeader
        eyebrow="More"
        title="Everything else"
        subtitle="Daily tabs stay focused. Open tools, account settings, and household admin from here."
        icon="grid"
        density="compact"
      />

      <SectionTitle title="Planning tools" />
      <View style={styles.stack}>
        {links.map((link) => (
          <Pressable
            key={link.key}
            accessibilityRole="button"
            accessibilityLabel={`Open ${link.title}`}
            onPress={() => onOpen(link.key)}
            style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          >
            <View style={[styles.linkIcon, toneStyles[link.tone]]}>
              <Ionicons color={toneColors[link.tone]} name={link.icon} size={20} />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>{link.title}</Text>
              <Text style={styles.linkSubtitle}>{link.subtitle}</Text>
              {link.meta ? <Text style={styles.linkMeta}>{link.meta}</Text> : null}
            </View>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </View>

      <SectionTitle title="Account & household" />
      <View style={styles.stack}>
        {onOpenSettings ? (
          <Card>
            <Text style={styles.adminTitle}>Settings</Text>
            <Text style={styles.adminText}>Profile, notifications, security, and sign-out.</Text>
            <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.adminButton}>
              <Text style={styles.adminButtonLabel}>Open settings</Text>
            </Pressable>
          </Card>
        ) : null}

        {onOpenFamilySettings ? (
          <Card>
            <Text style={styles.adminTitle}>Household</Text>
            <Text style={styles.adminText}>
              Invite adults, add child profiles, and manage KC- pairing codes.
            </Text>
            <Pressable accessibilityRole="button" onPress={onOpenFamilySettings} style={styles.adminButton}>
              <Text style={styles.adminButtonLabel}>Open household</Text>
            </Pressable>
            {kidCount > 0 ? (
              <Text style={styles.adminHint}>{kidCount} child profile{kidCount === 1 ? "" : "s"} ready for pairing.</Text>
            ) : (
              <Text style={styles.adminHint}>Add a child profile before pairing a phone.</Text>
            )}
          </Card>
        ) : null}

        {onOpenInsights ? (
          <Card>
            <View style={styles.insightsRow}>
              <View style={styles.linkCopy}>
                <Text style={styles.adminTitle}>Insights</Text>
                <Text style={styles.adminText}>Weekly read on plans, chores, and household load.</Text>
              </View>
              <Pill label="Preview" tone="gold" />
            </View>
            <Pressable accessibilityRole="button" onPress={onOpenInsights} style={styles.adminButton}>
              <Text style={styles.adminButtonLabel}>Open insights (preview)</Text>
            </Pressable>
          </Card>
        ) : null}
      </View>
    </View>
  );
}

const toneColors = {
  primary: colors.primary,
  mint: colors.mint,
  gold: colors.gold,
  coral: colors.coral
} as const;

const toneStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primarySoft },
  mint: { backgroundColor: "rgba(95, 168, 136, 0.14)" },
  gold: { backgroundColor: "rgba(214, 168, 74, 0.16)" },
  coral: { backgroundColor: "rgba(224, 122, 95, 0.14)" }
});

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  linkCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 84,
    padding: spacing.md
  },
  linkCardPressed: {
    opacity: 0.92
  },
  linkIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  linkCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  linkTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700"
  },
  linkSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  linkMeta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase"
  },
  adminTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  adminText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: spacing.xs
  },
  adminHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  adminButton: {
    alignSelf: "flex-start",
    marginTop: spacing.md
  },
  adminButtonLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800"
  },
  insightsRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  }
});
