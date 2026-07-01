import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Pill, SectionTitle } from "../components/Primitives";
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

type AdminNavItem = {
  key: string;
  title: string;
  subtitle: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "mint" | "gold";
  pill?: string;
  onPress: () => void;
};

function AdminNavRow({ item }: { item: AdminNavItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      onPress={item.onPress}
      style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
    >
      <View style={[styles.linkIcon, adminToneStyles[item.tone]]}>
        <Ionicons color={adminToneColors[item.tone]} name={item.icon} size={20} />
      </View>
      <View style={styles.linkCopy}>
        <View style={styles.adminTitleRow}>
          <Text style={styles.linkTitle}>{item.title}</Text>
          {item.pill ? <Pill label={item.pill} tone="gold" /> : null}
        </View>
        <Text style={styles.linkSubtitle}>{item.subtitle}</Text>
        {item.hint ? <Text style={styles.adminHint}>{item.hint}</Text> : null}
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

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
      subtitle: "Draft ideas. You approve every save.",
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
      subtitle: "Share updates or import family text.",
      icon: "chatbubbles",
      tone: "mint",
      meta: textUpdates.length > 0 ? `${textUpdates.length} on board` : "Share an update"
    }
  ];

  const adminItems: AdminNavItem[] = [
    ...(onOpenSettings
      ? [
          {
            key: "settings",
            title: "Settings",
            subtitle: "Profile, notifications, and sign-out.",
            icon: "settings-outline" as const,
            tone: "primary" as const,
            onPress: onOpenSettings
          }
        ]
      : []),
    ...(onOpenFamilySettings
      ? [
          {
            key: "household",
            title: "Household",
            subtitle: "Invite adults, child profiles, and KC- pairing.",
            hint:
              kidCount > 0
                ? `${kidCount} child profile${kidCount === 1 ? "" : "s"} ready to pair.`
                : "Add a child profile before pairing a phone.",
            icon: "people" as const,
            tone: "mint" as const,
            onPress: onOpenFamilySettings
          }
        ]
      : []),
    ...(onOpenInsights
      ? [
          {
            key: "insights",
            title: "Insights",
            subtitle: "Weekly read on plans, chores, and load.",
            icon: "stats-chart" as const,
            tone: "gold" as const,
            pill: "Preview",
            onPress: onOpenInsights
          }
        ]
      : [])
  ];

  return (
    <View>
      <ScreenHeader
        eyebrow="More"
        title="Tools & household"
        subtitle="Planning tools, settings, and admin live here."
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

      {adminItems.length > 0 ? (
        <>
          <SectionTitle title="Account & household" />
          <View style={styles.stack}>
            {adminItems.map((item) => (
              <AdminNavRow key={item.key} item={item} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const toneColors = {
  primary: colors.primary,
  mint: colors.mint,
  gold: colors.gold,
  coral: colors.coral
} as const;

const adminToneColors = {
  primary: colors.primary,
  mint: colors.mint,
  gold: colors.gold
} as const;

const toneStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primarySoft },
  mint: { backgroundColor: "rgba(95, 168, 136, 0.14)" },
  gold: { backgroundColor: "rgba(214, 168, 74, 0.16)" },
  coral: { backgroundColor: "rgba(224, 122, 95, 0.14)" }
});

const adminToneStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primarySoft },
  mint: { backgroundColor: "rgba(95, 168, 136, 0.14)" },
  gold: { backgroundColor: "rgba(214, 168, 74, 0.16)" }
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
    minHeight: 72,
    padding: spacing.md
  },
  linkCardPressed: {
    backgroundColor: colors.canvas,
    opacity: 0.96
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
  adminTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
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
  adminHint: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2
  }
});
