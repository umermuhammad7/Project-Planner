import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, Image } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { TabKey } from "../types";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";
import { formatNotificationType } from "../utils/notificationLabels";
import { getSyncPillLabel, getSyncPillTone } from "../utils/syncTrustCopy";

type HomeHighlight = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "primary" | "mint" | "gold" | "coral" | "neutral";
  tab?: TabKey;
};

export function HomeScreen({
  goTo,
  onEnterKidsMode,
  onOpenFamilySettings,
  onOpenInsights,
  onOpenSettings
}: {
  goTo: (tab: TabKey) => void;
  onEnterKidsMode?: () => void;
  onOpenFamilySettings?: () => void;
  onOpenInsights?: () => void;
  onOpenSettings?: () => void;
}) {
  const displayName = useAuthStore((state) => state.displayName);
  const email = useAuthStore((state) => state.email);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const authMode = useAuthStore((state) => state.mode);
  const {
    familyName,
    members,
    events,
    meals,
    chores,
    notifications,
    markNotificationsRead,
    refreshFromBackend,
    syncSource,
    syncMessage,
    isHydrating
  } = useHomeThreadStore();
  const listItemsByListId = useHomeThreadStore((state) => state.listItemsByListId);

  const todayDateParts = useMemo(() => formatDateParts(new Date()), []);
  const backendConnected = syncSource === "api";
  const isSignedIn = authMode === "supabase" || authMode === "dev_token";
  const openChores = useMemo(() => chores.filter((chore) => !chore.completed), [chores]);
  const openItems = useMemo(
    () => Object.values(listItemsByListId).flat().filter((item) => !item.checked),
    [listItemsByListId]
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.readAt),
    [notifications]
  );
  const nextEvent = useMemo(
    () =>
      [...events]
        .sort(compareEventsByStartAt)
        .find((event) => getEventUrgency(event)?.label !== "Past") ?? null,
    [events]
  );
  const nextUrgency = nextEvent ? getEventUrgency(nextEvent) : null;
  const allDinners = useMemo(() => meals.filter((meal) => meal.mealType === "dinner"), [meals]);
  const todayDinner = useMemo(() => {
    const day = new Date().getDay();
    const normalized = day === 0 ? 6 : day - 1;
    return allDinners.find((meal) => meal.dayOfWeek === normalized) ?? null;
  }, [allDinners]);
  const kidMembers = useMemo(() => members.filter((member) => member.role === "kid"), [members]);
  const adultMembers = useMemo(() => members.filter((member) => member.role !== "kid"), [members]);
  const kidStarTotal = useMemo(
    () => kidMembers.reduce((sum, member) => sum + member.starBalance, 0),
    [kidMembers]
  );
  const kidsWithOpenChores = useMemo(
    () =>
      kidMembers
        .map((member) => ({
          member,
          openCount: openChores.filter((chore) => chore.assignedTo === member.id).length
        }))
        .filter((entry) => entry.openCount > 0),
    [kidMembers, openChores]
  );
  const recentNotifications = useMemo(() => notifications.slice(0, 3), [notifications]);
  const profileLabel = useMemo(() => displayName?.trim() || email?.split("@")[0] || "there", [displayName, email]);
  const profileInitials = useMemo(
    () =>
      profileLabel
        .split(/\s+/u)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [profileLabel]
  );
  const avatarSource = useMemo(
    () => (avatarUrl ? { uri: avatarUrl, cache: "reload" as const } : null),
    [avatarUrl]
  );
  const householdSummaryLabel = useMemo(() => {
    const adults = adultMembers.length;
    const kids = kidMembers.length;

    if (adults > 0 && kids > 0) {
      return `${adults} adult${adults === 1 ? "" : "s"}, ${kids} kid${kids === 1 ? "" : "s"}`;
    }

    if (adults > 0) {
      return `${adults} adult${adults === 1 ? "" : "s"}`;
    }

    if (kids > 0) {
      return `${kids} kid${kids === 1 ? "" : "s"}`;
    }

    return "Household";
  }, [adultMembers.length, kidMembers.length]);

  const homeHighlights = useMemo<HomeHighlight[]>(() => {
    const entries: HomeHighlight[] = [];

    if (nextEvent) {
      entries.push({
        key: "next-event",
        icon: "calendar-outline",
        label: "Next plan",
        value: `${nextEvent.title} at ${nextEvent.time}`,
        tone: nextUrgency?.tone ?? "primary",
        tab: "plan"
      });
    }

    if (openChores.length > 0) {
      entries.push({
        key: "chores",
        icon: "checkmark-done-outline",
        label: "Open chores",
        value: `${openChores.length} open`,
        tone: "gold",
        tab: "chores"
      });
    }

    if (todayDinner) {
      entries.push({
        key: "dinner",
        icon: "restaurant-outline",
        label: "Tonight",
        value: todayDinner.title,
        tone: "coral",
        tab: "meals"
      });
    }

    if (openItems.length > 0) {
      entries.push({
        key: "shopping",
        icon: "bag-handle-outline",
        label: "Shopping",
        value: `${openItems.length} to pick up`,
        tone: "mint",
        tab: "lists"
      });
    }

    if (unreadNotifications.length > 0) {
      entries.push({
        key: "notifications",
        icon: "notifications-outline",
        label: "Unread",
        value: `${unreadNotifications.length} waiting`,
        tone: "primary",
        tab: "thread"
      });
    }

    return entries.slice(0, 4);
  }, [nextEvent, nextUrgency?.tone, openChores.length, todayDinner, openItems.length, unreadNotifications.length]);

  const dayHeadline = nextEvent
    ? `${nextEvent.title} is setting the pace today.`
    : openChores.length > 0
      ? "A few things still need an owner."
      : todayDinner
        ? "Dinner is one less thing to solve tonight."
        : "The day looks calm from here.";

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>Good day, {profileLabel}</Text>
          <Text style={styles.kicker}>{familyName}</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>Today - {todayDateParts.compact}</Text>
          </View>
          <View style={styles.headerMeta}>
            <Pill label={householdSummaryLabel} tone="neutral" icon="people" />
          </View>
        </View>
        <View style={styles.headerRail}>
          {onOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open settings for ${profileLabel}`}
              onPress={onOpenSettings}
              style={styles.profileButton}
            >
              {avatarSource ? (
                <Image accessibilityLabel={`${profileLabel} profile photo`} source={avatarSource} style={styles.profileImage} />
              ) : (
                <Text style={styles.profileInitials}>{profileInitials}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.heroShell}>
        <LinearGradient
          colors={[colors.surface, "#F4EEE6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroPanel}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Pill
                label={getSyncPillLabel(syncSource)}
                tone={getSyncPillTone(syncSource)}
                icon={backendConnected ? "sparkles" : "information-circle"}
              />
              <Text style={styles.heroTitle}>{dayHeadline}</Text>
              <Text style={styles.heroText}>
                {nextEvent
                  ? `${nextUrgency?.label ?? "Coming up"} at ${nextEvent.time}${nextEvent.location ? ` - ${nextEvent.location}` : ""}`
                  : todayDinner
                    ? `${todayDinner.title} is already penciled in for tonight.`
                    : "Add the next plan, list, or chore before someone has to carry it by memory."}
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <PrimaryButton label="Ask assistant" icon="sparkles" onPress={() => goTo("add")} />
            <PrimaryButton label="Family board" icon="chatbubbles" tone="ghost" onPress={() => goTo("thread")} />
            {onEnterKidsMode && kidMembers.length > 0 ? (
              <PrimaryButton label="Kids mode" icon="happy" tone="ghost" onPress={onEnterKidsMode} />
            ) : onEnterKidsMode ? (
              <Text style={styles.kidsHint}>Add a child profile in Household to use Kids mode on this phone.</Text>
            ) : null}
          </View>

          {homeHighlights.length > 0 ? (
            <View style={styles.highlightGrid}>
              {homeHighlights.map((item) => {
                const content = (
                  <>
                    <View style={[styles.highlightIcon, highlightToneStyles[item.tone]]}>
                      <Ionicons name={item.icon} size={18} color={highlightToneColors[item.tone]} />
                    </View>
                    <Text style={styles.highlightLabel}>{item.label}</Text>
                    <Text style={styles.highlightValue} numberOfLines={2}>
                      {item.value}
                    </Text>
                  </>
                );

                if (!item.tab) {
                  return (
                    <View key={item.key} style={styles.highlightCard}>
                      {content}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.label}: ${item.value}`}
                    onPress={() => goTo(item.tab!)}
                    style={({ pressed }) => [styles.highlightCard, styles.highlightCardPressable, pressed && styles.highlightCardPressed]}
                  >
                    {content}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelTitle}>A quiet page is a good sign.</Text>
              <Text style={styles.emptyPanelText}>
                Nothing urgent is crowding the day right now. Add the first plan when something actually matters.
              </Text>
            </View>
          )}

          <View style={styles.syncRow}>
            <Text style={styles.syncText}>
              {isHydrating
                ? "Refreshing the household page..."
                : backendConnected
                  ? syncMessage
                  : isSignedIn && syncMessage?.trim()
                    ? syncMessage
                    : "You're viewing preview data on this device. Sign in to share with your household."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh household page"
              onPress={() => {
                if (isHydrating) return;
                void refreshFromBackend();
              }}
              style={({ pressed }) => [styles.refreshLink, pressed && styles.refreshLinkPressed]}
            >
              <Ionicons name="sync" size={14} color={colors.primary} />
              <Text style={styles.refreshLinkText}>{isHydrating ? "Refreshing" : "Refresh"}</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {kidsWithOpenChores.length > 0 ? (
        <>
          <SectionTitle title="Kids who need a nudge" action={`${kidStarTotal} stars saved`} />
          <View style={styles.stack}>
            {kidsWithOpenChores.map(({ member, openCount }) => (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={`Open chores for ${member.name}`}
                onPress={() => goTo("chores")}
              >
                <Card>
                  <Row>
                    <MemberAvatar member={member} size={40} />
                    <View style={styles.fill}>
                      <Text style={styles.itemTitle}>{member.name}</Text>
                      <Text style={styles.itemMeta}>
                        {openCount} chore{openCount === 1 ? "" : "s"} open - {member.starBalance} stars waiting
                      </Text>
                    </View>
                    <Pill label={`${member.starBalance} stars`} tone="gold" icon="star" />
                  </Row>
                </Card>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle
        title="Family board"
        action={unreadNotifications.length > 0 ? `${unreadNotifications.length} unread` : "All caught up"}
      />
      <View style={styles.stack}>
        {recentNotifications.length > 0 ? (
          recentNotifications.map((notification) => (
            <View key={notification.id} style={styles.boardRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open board update: ${notification.title}`}
                onPress={() => goTo("thread")}
                style={({ pressed }) => [styles.boardRowMain, pressed && styles.boardRowPressed]}
              >
                <View
                  style={[
                    styles.notificationIcon,
                    notification.readAt ? styles.notificationIconMuted : styles.notificationIconUnread
                  ]}
                >
                  <Ionicons
                    name={notification.readAt ? "notifications-outline" : "notifications"}
                    size={18}
                    color={notification.readAt ? colors.muted : colors.primary}
                  />
                </View>
                <View style={styles.fill}>
                  <View style={styles.boardMetaRow}>
                    <Text style={styles.boardTypeCue}>{formatNotificationType(notification.type)}</Text>
                    {!notification.readAt ? (
                      <View style={styles.boardUnreadCue}>
                        <Text style={styles.boardUnreadCueText}>Unread</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {notification.title}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={2}>
                    {notification.body}
                  </Text>
                </View>
              </Pressable>
              {!notification.readAt ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark notification read"
                  hitSlop={8}
                  onPress={() => {
                    void markNotificationsRead([notification.id]);
                  }}
                  style={styles.markReadButton}
                >
                  <Text style={styles.markReadLabel}>Read</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <View style={styles.boardEmpty}>
            <Text style={styles.emptyPanelText}>No updates yet.</Text>
            <Pressable accessibilityRole="button" onPress={() => goTo("thread")} style={styles.boardLink}>
              <Text style={styles.boardLinkText}>Open family board</Text>
            </Pressable>
          </View>
        )}
      </View>

      {onOpenFamilySettings || onOpenInsights ? (
        <View style={styles.adminLinks}>
          {onOpenFamilySettings ? (
            <Pressable accessibilityRole="button" onPress={onOpenFamilySettings} style={styles.adminLink}>
              <Text style={styles.adminLinkText}>Household</Text>
            </Pressable>
          ) : null}
          {onOpenInsights ? (
            <Pressable accessibilityRole="button" onPress={onOpenInsights} style={styles.adminLink}>
              <Text style={styles.adminLinkText}>Insights</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

    </View>
  );
}

function formatDateParts(date: Date) {
  return {
    weekday: date.toLocaleDateString(undefined, {
      weekday: "long"
    }),
    monthDay: date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric"
    }),
    compact: date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    })
  };
}

const highlightToneColors = {
  primary: colors.primary,
  mint: colors.mint,
  gold: "#996A00",
  coral: colors.coral,
  neutral: colors.muted
} as const;

const highlightToneStyles = {
  primary: { backgroundColor: colors.primarySoft },
  mint: { backgroundColor: colors.mintSoft },
  gold: { backgroundColor: colors.goldSoft },
  coral: { backgroundColor: colors.coralSoft },
  neutral: { backgroundColor: "#F1ECE5" }
} as const;

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  greeting: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  dateBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  dateBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  headerRail: {
    alignItems: "flex-start",
    marginLeft: spacing.md,
    paddingTop: spacing.xs
  },
  headerMeta: {
    marginTop: spacing.sm
  },
  memberStack: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingTop: spacing.xs
  },
  kidsHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.xs
  },
  profileButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.16)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    overflow: "hidden",
    width: 42
  },
  profileImage: {
    height: 42,
    width: 42
  },
  profileInitials: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  heroShell: {
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden"
  },
  heroPanel: {
    borderRadius: radii.md,
    gap: spacing.lg,
    padding: spacing.lg
  },
  heroTop: {
    gap: spacing.md
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34
  },
  heroText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  highlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  highlightCard: {
    backgroundColor: "rgba(255,252,248,0.86)",
    borderColor: "rgba(215,205,188,0.7)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: "46%",
    padding: spacing.md
  },
  highlightIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  highlightLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: spacing.xs,
    textTransform: "uppercase"
  },
  highlightValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20
  },
  emptyPanel: {
    backgroundColor: "rgba(255,252,248,0.82)",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg
  },
  emptyPanelTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24
  },
  emptyPanelText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  highlightCardPressable: {},
  highlightCardPressed: {
    opacity: 0.88
  },
  syncText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1
  },
  syncRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  refreshLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  refreshLinkPressed: {
    opacity: 0.76
  },
  refreshLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  stack: {
    gap: spacing.md
  },
  snapshotRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  snapshotColumn: {
    flex: 1,
    gap: spacing.xs
  },
  snapshotLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28
  },
  snapshotMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  adminLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  adminLink: {
    minHeight: 36,
    justifyContent: "center",
    paddingVertical: spacing.xs
  },
  adminLinkText: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "700"
  },
  boardRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  boardRowMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    minWidth: 0
  },
  boardRowPressed: {
    opacity: 0.84
  },
  boardMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: 2
  },
  boardTypeCue: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  boardUnreadCue: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2
  },
  boardUnreadCueText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  boardEmpty: {
    gap: spacing.xs,
    paddingVertical: spacing.sm
  },
  boardLink: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center"
  },
  boardLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  markReadButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  markReadLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  fill: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 2
  },
  notificationIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  notificationIconUnread: {
    backgroundColor: colors.primarySoft
  },
  notificationIconMuted: {
    backgroundColor: "#F1ECE5"
  },
  notificationMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.sm
  },
  boardActionRow: {
    marginBottom: spacing.sm
  },
  notificationTapArea: {
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md
  },

});
