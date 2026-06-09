import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { Chore, TabKey } from "../types";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";
import { formatNotificationType } from "../utils/notificationLabels";
import { getSyncPillLabel, getSyncPillTone } from "../utils/syncTrustCopy";

type HomeHighlight = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "primary" | "mint" | "gold" | "coral" | "neutral";
};

export function HomeScreen({
  goTo,
  onEnterKidsMode,
  onOpenFamilySettings,
  onOpenInsights
}: {
  goTo: (tab: TabKey) => void;
  onEnterKidsMode?: () => void;
  onOpenFamilySettings?: () => void;
  onOpenInsights?: () => void;
}) {
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

  const todayLabel = useMemo(() => formatLongDate(new Date()), []);
  const backendConnected = syncSource === "api";
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
  const nextTwoChores = useMemo(() => openChores.slice(0, 2), [openChores]);
  const allDinners = useMemo(() => meals.filter((meal) => meal.mealType === "dinner"), [meals]);
  const todayDinner = useMemo(() => {
    const day = new Date().getDay();
    const normalized = day === 0 ? 6 : day - 1;
    return allDinners.find((meal) => meal.dayOfWeek === normalized) ?? null;
  }, [allDinners]);
  const dinners = useMemo(() => allDinners.slice(0, 3), [allDinners]);
  const kidMembers = useMemo(() => members.filter((member) => member.role === "kid"), [members]);
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

  const homeHighlights = useMemo<HomeHighlight[]>(() => {
    const entries: HomeHighlight[] = [];

    if (nextEvent) {
      entries.push({
        key: "next-event",
        icon: "calendar-outline",
        label: "Next plan",
        value: `${nextEvent.title} at ${nextEvent.time}`,
        tone: nextUrgency?.tone ?? "primary"
      });
    }

    if (openChores.length > 0) {
      entries.push({
        key: "chores",
        icon: "checkmark-done-outline",
        label: "Open chores",
        value: `${openChores.length} still need eyes on them`,
        tone: "gold"
      });
    }

    if (todayDinner) {
      entries.push({
        key: "dinner",
        icon: "restaurant-outline",
        label: "Tonight",
        value: todayDinner.title,
        tone: "coral"
      });
    }

    if (openItems.length > 0) {
      entries.push({
        key: "shopping",
        icon: "bag-handle-outline",
        label: "Shopping",
        value: `${openItems.length} items left to pick up`,
        tone: "mint"
      });
    }

    if (unreadNotifications.length > 0) {
      entries.push({
        key: "notifications",
        icon: "notifications-outline",
        label: "Unread",
        value: `${unreadNotifications.length} family updates are waiting`,
        tone: "primary"
      });
    }

    return entries.slice(0, 4);
  }, [nextEvent, nextUrgency?.tone, openChores.length, todayDinner, openItems.length, unreadNotifications.length]);

  const dayHeadline = nextEvent
    ? `${nextEvent.title} is setting the pace today.`
    : openChores.length > 0
      ? "A few house jobs still need a clear owner."
      : todayDinner
        ? "Dinner is already one less thing to think about."
        : "The day looks calm from here.";

  const daySupport = buildHomeSummary({
    nextEventTitle: nextEvent?.title,
    nextEventTime: nextEvent?.time,
    openChoreCount: openChores.length,
    openItemCount: openItems.length,
    unreadCount: unreadNotifications.length
  });

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Today in {familyName}</Text>
          <Text style={styles.title}>{todayLabel}</Text>
          <Text style={styles.subhead}>{daySupport}</Text>
        </View>
        <View style={styles.memberStack}>
          {members.slice(0, 3).map((member) => (
            <MemberAvatar key={member.id} member={member} size={38} />
          ))}
        </View>
      </View>

      <Card>
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
                    : "Add the next plan, list, or chore before the household starts carrying it by memory."}
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
            </View>
          </View>

          {homeHighlights.length > 0 ? (
            <View style={styles.highlightGrid}>
              {homeHighlights.map((item) => (
                <View key={item.key} style={styles.highlightCard}>
                  <View style={[styles.highlightIcon, highlightToneStyles[item.tone]]}>
                    <Ionicons name={item.icon} size={18} color={highlightToneColors[item.tone]} />
                  </View>
                  <Text style={styles.highlightLabel}>{item.label}</Text>
                  <Text style={styles.highlightValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelTitle}>A quiet page is a good sign.</Text>
              <Text style={styles.emptyPanelText}>
                Nothing urgent is crowding the household right now. Add the first plan only when something actually matters.
              </Text>
            </View>
          )}

          <View style={styles.heroActions}>
            <PrimaryButton
              label={isHydrating ? "Refreshing..." : "Refresh"}
              icon="sync"
              tone="ghost"
              onPress={() => {
                if (isHydrating) return;
                void refreshFromBackend();
              }}
            />
            <PrimaryButton label="Quick add" icon="add" onPress={() => goTo("add")} />
            <PrimaryButton label="Family board" icon="chatbubbles" tone="soft" onPress={() => goTo("thread")} />
          </View>
          <Text style={styles.syncText}>
            {isHydrating
              ? "Refreshing the household page..."
              : backendConnected
                ? syncMessage
                : "This build is running in local preview. Connect the backend when you want the whole household to share the same live state."}
          </Text>
        </LinearGradient>
      </Card>

      <SectionTitle title="Today's picture" />
      <View style={styles.stack}>
        <Card>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotLabel}>Next plan</Text>
              <Text style={styles.snapshotValue}>{nextEvent ? nextEvent.title : "Nothing is scheduled yet"}</Text>
              <Text style={styles.snapshotMeta}>
                {nextEvent
                  ? `${nextEvent.time}${nextEvent.location ? ` - ${nextEvent.location}` : ""}`
                  : "Add the first event when the day starts taking shape."}
              </Text>
            </View>
            {nextUrgency ? <Pill label={nextUrgency.label} tone={nextUrgency.tone} /> : null}
          </View>
        </Card>

        <Card>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotLabel}>Tonight</Text>
              <Text style={styles.snapshotValue}>{todayDinner ? todayDinner.title : "Dinner is still open"}</Text>
              <Text style={styles.snapshotMeta}>
                {todayDinner ? "One decision is already off the table." : "Use Meals before the evening rush sneaks up."}
              </Text>
            </View>
            <Ionicons name="restaurant-outline" size={22} color={colors.coral} />
          </View>
        </Card>

        <Card>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotLabel}>Open chores</Text>
              <Text style={styles.snapshotValue}>
                {openChores.length === 0 ? "Everything is caught up" : `${openChores.length} still open`}
              </Text>
              <Text style={styles.snapshotMeta}>
                {nextTwoChores.length > 0 ? formatChorePreview(nextTwoChores, members) : "No handoff is hanging over the household."}
              </Text>
            </View>
            <Ionicons name="checkmark-done-outline" size={22} color={colors.gold} />
          </View>
        </Card>
      </View>

      <SectionTitle title="Move the week forward" />
      <View style={styles.quickActionGrid}>
        {onEnterKidsMode ? (
          <Card>
            <Text style={styles.quickTitle}>Hand it to the kids</Text>
            <Text style={styles.quickText}>
              Open the simplified chore view when you want the phone to feel like their part of the household.
            </Text>
            <View style={styles.quickActionFooter}>
              <PrimaryButton label="Open kids mode" icon="happy" tone="soft" onPress={onEnterKidsMode} />
            </View>
          </Card>
        ) : null}
        {onOpenFamilySettings ? (
          <Card>
            <Text style={styles.quickTitle}>Shape the household</Text>
            <Text style={styles.quickText}>
              Invite another adult, add child profiles, or tidy the home settings before more people join.
            </Text>
            <View style={styles.quickActionFooter}>
              <PrimaryButton label="Open household" icon="people" tone="soft" onPress={onOpenFamilySettings} />
            </View>
          </Card>
        ) : null}
        {onOpenInsights ? (
          <Card>
            <Text style={styles.quickTitle}>Read the week</Text>
            <Text style={styles.quickText}>
              Check whether chores, busyness, and family rhythm are actually holding together this week.
            </Text>
            <View style={styles.quickActionFooter}>
              <PrimaryButton label="See insights" icon="analytics" tone="soft" onPress={onOpenInsights} />
            </View>
          </Card>
        ) : null}
      </View>

      {kidsWithOpenChores.length > 0 ? (
        <>
          <SectionTitle title="Kids who need a nudge" action={`${kidStarTotal} stars saved`} />
          <View style={styles.stack}>
            {kidsWithOpenChores.map(({ member, openCount }) => (
              <Card key={member.id}>
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
            <Card key={notification.id}>
              <Row align="flex-start">
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
                  <Row>
                    <Pill label={formatNotificationType(notification.type)} tone="neutral" />
                    {!notification.readAt ? <Pill label="Unread" tone="primary" /> : null}
                  </Row>
                  <Text style={styles.itemTitle}>{notification.title}</Text>
                  <Text style={styles.itemMeta}>{notification.body}</Text>
                  <Text style={styles.notificationMeta}>{new Date(notification.sentAt).toLocaleString()}</Text>
                </View>
                {!notification.readAt ? (
                  <PrimaryButton
                    label="Mark read"
                    icon="checkmark"
                    tone="ghost"
                    onPress={() => {
                      void markNotificationsRead([notification.id]);
                    }}
                  />
                ) : null}
              </Row>
            </Card>
          ))
        ) : (
          <Card>
            <Text style={styles.emptyPanelTitle}>No updates are waiting.</Text>
            <Text style={styles.emptyPanelText}>
              In-app alerts land here after digests and reminders are recorded. Push delivery is still limited in this build.
            </Text>
          </Card>
        )}
      </View>

      <SectionTitle title="Meals taking shape" action={`${meals.length} meals planned`} />
      <View style={styles.stack}>
        {dinners.length > 0 ? (
          dinners.map((meal) => (
            <Card key={meal.id}>
              <Row>
                <View style={styles.timeBlock}>
                  <Text style={styles.time}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][meal.dayOfWeek]}</Text>
                  <Text style={styles.date}>{meal.mealType}</Text>
                </View>
                <View style={styles.fill}>
                  <Text style={styles.itemTitle}>{meal.title}</Text>
                  <Text style={styles.itemMeta}>{meal.notes ?? "Ready for the week"}</Text>
                </View>
              </Row>
            </Card>
          ))
        ) : (
          <Card>
            <Text style={styles.emptyPanelTitle}>No dinners are planned yet.</Text>
            <Text style={styles.emptyPanelText}>
              Even two planned nights make the rest of the week feel lighter. Start with the ones that usually get hectic.
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function buildHomeSummary(input: {
  nextEventTitle?: string;
  nextEventTime?: string;
  openChoreCount: number;
  openItemCount: number;
  unreadCount: number;
}) {
  const parts: string[] = [];

  if (input.nextEventTitle && input.nextEventTime) {
    parts.push(`${input.nextEventTitle} at ${input.nextEventTime}`);
  }

  if (input.openChoreCount > 0) {
    parts.push(`${input.openChoreCount} open chore${input.openChoreCount === 1 ? "" : "s"}`);
  }

  if (input.openItemCount > 0) {
    parts.push(`${input.openItemCount} list item${input.openItemCount === 1 ? "" : "s"}`);
  }

  if (input.unreadCount > 0) {
    parts.push(`${input.unreadCount} unread update${input.unreadCount === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return "Nothing urgent is pressing on the household right now.";
  }

  return parts.join(" - ");
}

function formatChorePreview(chores: Chore[], members: ReturnType<typeof useHomeThreadStore.getState>["members"]) {
  return chores
    .map((chore) => {
      const memberName = members.find((member) => member.id === chore.assignedTo)?.name;
      return memberName ? `${chore.title} for ${memberName}` : chore.title;
    })
    .join(" - ");
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
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: "700",
    lineHeight: 44
  },
  subhead: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  memberStack: {
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: spacing.md,
    paddingTop: spacing.sm
  },
  heroPanel: {
    borderRadius: radii.md,
    gap: spacing.lg,
    padding: spacing.md
  },
  heroTop: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm
  },
  heroIcon: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderColor: "rgba(139,107,74,0.12)",
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46
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
  syncText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18
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
  quickActionGrid: {
    gap: spacing.md
  },
  quickTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 27
  },
  quickText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: spacing.xs
  },
  quickActionFooter: {
    marginTop: spacing.md
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
  timeBlock: {
    alignItems: "center",
    minWidth: 54
  },
  time: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700"
  },
  date: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  }
});
