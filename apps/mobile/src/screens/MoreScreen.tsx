import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Pill, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MoreDestination } from "../types";

type MoreLink = {
  key: MoreDestination;
  title: string;
  subtitle: string;
  icon: string;
  tone: "primary" | "mint" | "gold" | "coral";
  meta: string;
  metaKind: "status" | "cta";
};

type AdminNavItem = {
  key: string;
  title: string;
  subtitle: string;
  hint?: string;
  icon: string;
  tone: "primary" | "mint" | "gold";
  pill?: string;
  onPress: () => void;
};

function AdminNavRow({ item }: { item: AdminNavItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}${item.pill ? `, ${item.pill}` : ""}. ${item.subtitle}${item.hint ? `. ${item.hint}` : ""}`}
      onPress={item.onPress}
      style={({ pressed }) => [styles.adminShortcutTile, pressed && styles.linkCardPressed]}
    >
      <View style={styles.adminShortcutTop}>
        <View style={[styles.adminShortcutIcon, adminToneStyles[item.tone]]}>
          <Text style={styles.adminShortcutGlyph}>{item.icon}</Text>
        </View>
        <Ionicons color={colors.muted} name="arrow-forward" size={13} />
      </View>
      <View style={styles.adminShortcutCopy}>
        <View style={styles.adminTitleRow}>
          <Text style={styles.adminShortcutTitle}>{item.title}</Text>
          {item.pill ? <Pill label={item.pill} tone="gold" /> : null}
        </View>
        <Text numberOfLines={2} style={styles.adminShortcutMeta}>
          {item.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export function MoreScreen({
  onOpen,
  onOpenFamilySettings,
  onOpenInsights,
  onOpenSettings,
  pinnedHeader = false
}: {
  onOpen: (destination: MoreDestination) => void;
  onOpenFamilySettings?: () => void;
  onOpenInsights?: () => void;
  onOpenSettings?: () => void;
  pinnedHeader?: boolean;
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
      icon: "✨",
      tone: "primary",
      meta: "Draft your first idea",
      metaKind: "cta"
    },
    {
      key: "meals",
      title: "Meals",
      subtitle: "Plan the week and keep recipes handy.",
      icon: "🍴",
      tone: "coral",
      meta: meals.length > 0 ? `${meals.length} planned` : "Open week plan",
      metaKind: meals.length > 0 ? "status" : "cta"
    },
    {
      key: "board",
      title: "Text & Summaries",
      subtitle: "Paste a text to save it as a plan, or post a summary to share.",
      icon: "📋",
      tone: "mint",
      meta: textUpdates.length > 0 ? `${textUpdates.length} update${textUpdates.length === 1 ? "" : "s"} shared` : "Share an update",
      metaKind: textUpdates.length > 0 ? "status" : "cta"
    }
  ];

  const adminItems: AdminNavItem[] = [
    ...(onOpenSettings
      ? [
          {
            key: "settings",
            title: "Settings",
            subtitle: "Profile & alerts",
            icon: "⚙️",
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
            subtitle: kidCount > 0 ? `${kidCount} kid${kidCount === 1 ? "" : "s"} to pair` : "Invite & pair",
            icon: "🧑‍🤝‍🧑",
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
            subtitle: "Weekly summary",
            icon: "📊",
            tone: "gold" as const,
            pill: "Preview",
            onPress: onOpenInsights
          }
        ]
      : [])
  ];
  return (
    <View>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>🧭</Text>
          </View>
          <Text style={styles.largeTitleText}>More hub</Text>
        </View>
      ) : (
        <ScreenHeader
          eyebrow="More"
          title="More hub"
          subtitle="Planning tools, settings, and admin live here."
          density="compact"
        />
      )}

      <SectionTitle title="Planning tools" />
      <View style={styles.linkGroup}>
        {links.map((link, index) => (
          <Pressable
            key={link.key}
            accessibilityRole="button"
            accessibilityLabel={`Open ${link.title}`}
            onPress={() => onOpen(link.key)}
            style={({ pressed }) => [
              styles.linkCard,
              index < links.length - 1 && styles.linkCardDivider,
              pressed && styles.linkCardPressed
            ]}
          >
            <View style={styles.linkRowContent}>
              <View style={[styles.linkAccent, { backgroundColor: toneColors[link.tone] }]} />
              <View style={[styles.linkIcon, toneStyles[link.tone]]}>
                <Text style={styles.linkIconGlyph}>{link.icon}</Text>
              </View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>{link.title}</Text>
                <Text style={styles.linkSubtitle}>{link.subtitle}</Text>
                {link.metaKind === "cta" ? (
                  <Text style={[styles.linkMetaCta, { color: toneColors[link.tone] }]}>{link.meta}</Text>
                ) : (
                  <Text style={[styles.linkMeta, { color: toneColors[link.tone] }]}>{link.meta}</Text>
                )}
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} />
            </View>
          </Pressable>
        ))}
      </View>

      {adminItems.length > 0 ? (
        <View style={styles.adminCard}>
          <Text style={styles.adminCardTitle}>Account & household</Text>
          <View style={styles.adminShortcutGrid}>
            {adminItems.map((item) => (
              <AdminNavRow key={item.key} item={item} />
            ))}
          </View>
        </View>
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
  largeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center"
  },
  largeTitleIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  largeTitleGlyph: {
    fontSize: 20
  },
  largeTitleText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3
  },
  linkGroup: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card
  },
  linkCard: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  linkCardDivider: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1
  },
  linkCardPressed: {
    backgroundColor: colors.canvas,
    opacity: 0.96
  },
  linkRowContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  linkAccent: {
    alignSelf: "stretch",
    borderRadius: radii.pill,
    width: 3
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
  linkIconGlyph: {
    fontSize: 20,
    lineHeight: 24
  },
  adminCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
    ...shadow.card
  },
  adminCardTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: spacing.md
  },
  adminShortcutGrid: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  adminShortcutTile: {
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    flexBasis: "47%",
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 0,
    padding: spacing.md
  },
  adminShortcutTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  adminShortcutIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  adminShortcutCopy: {
    gap: spacing.xs,
    minWidth: 0
  },
  adminShortcutGlyph: {
    fontSize: 16,
    lineHeight: 20
  },
  adminTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  adminShortcutTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 18
  },
  adminShortcutMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16
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
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  linkMetaCta: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2
  },
  adminHint: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2
  }
});
