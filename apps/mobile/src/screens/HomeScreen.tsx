import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
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

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    []
  );
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
        icon: "calendar",
        label: "Next plan",
        value: `${nextEvent.title} at ${nextEvent.time}`,
        tone: nextUrgency?.tone ?? "primary"
      });
    }

    if (todayDinner) {
      entries.push({
        key: "dinner",
        icon: "restaurant",
        label: "Dinner",
        value: todayDinner.title,
        tone: "coral"
      });
    }

    if (openChores.length > 0) {
      entries.push({
        key: "chores",
        icon: "checkmark-done",
        label: "Open chores",
        value: `${openChores.length} still need attention`,
        tone: "gold"
      });
    }

    if (openItems.length > 0) {
      entries.push({
        key: "shopping",
        icon: "bag-handle",
        label: "Shopping",
        value: `${openItems.length} items left to grab`,
        tone: "mint"
      });
    }

    if (unreadNotifications.length > 0) {
      entries.push({
        key: "notifications",
        icon: "notifications",
        label: "Unread updates",
        value: `${unreadNotifications.length} waiting`,
        tone: "primary"
      });
    }

    return entries.slice(0, 4);
  }, [nextEvent, nextUrgency?.tone, todayDinner, openChores.length, openItems.length, unreadNotifications.length]);

  const heroTitle = nextEvent
    ? `${nextEvent.title} is the next thing that matters.`
    : openChores.length > 0
      ? "A few chores are still open today."
      : todayDinner
        ? "Tonight's dinner already has a plan."
        : "The day is clear right now.";

  const heroText = nextEvent
    ? `${nextUrgency?.label ?? nextEvent.dateLabel}${nextEvent.location ? ` - ${nextEvent.location}` : ""}`
    : openChores.length > 0
      ? `${openChores.length} chores and ${openItems.length} shopping items are still open.`
      : "Add the first plan, list, or chore so everyone knows what today looks like.";

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>HomeThread</Text>
          <Text style={styles.title}>{familyName}</Text>
          <Text style={styles.subhead}>{todayLabel}</Text>
        </View>
        <View style={styles.memberStack}>
          {members.slice(0, 3).map((member) => (
            <MemberAvatar key={member.id} member={member} size={36} />
          ))}
        </View>
      </View>

      <Card>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Pill
              label={getSyncPillLabel(syncSource)}
              tone={getSyncPillTone(syncSource)}
              icon={backendConnected ? "sparkles" : "information-circle"}
            />
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroText}>{heroText}</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="sunny" size={26} color={colors.gold} />
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
            <Text style={styles.emptyPanelTitle}>A calm start is a good sign.</Text>
            <Text style={styles.emptyPanelText}>
              No urgent plans, chores, or shopping items are showing yet. Add the first one before texts start flying.
            </Text>
          </View>
        )}

        <View style={styles.heroActions}>
          <PrimaryButton
            label={isHydrating ? "Refreshing..." : "Refresh"}
            icon="sync"
            tone="dark"
            onPress={() => {
              if (isHydrating) return;
              void refreshFromBackend();
            }}
          />
          <PrimaryButton label="Quick add" icon="add" onPress={() => goTo("add")} />
          <PrimaryButton label="Digest" icon="chatbubbles" tone="dark" onPress={() => goTo("thread")} />
        </View>
        <Text style={styles.syncText}>
          {isHydrating ? "Refreshing household data..." : backendConnected ? syncMessage : "Local preview — connect the backend to sync for everyone."}
        </Text>
      </Card>

      <SectionTitle title="Today at a glance" />
      <View style={styles.stack}>
        <Card>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotLabel}>Next plan</Text>
              <Text style={styles.snapshotValue}>{nextEvent ? nextEvent.title : "Nothing scheduled yet"}</Text>
              <Text style={styles.snapshotMeta}>
                {nextEvent
                  ? `${nextEvent.time}${nextEvent.location ? ` - ${nextEvent.location}` : ""}`
                  : "Add the first event when the family day takes shape."}
              </Text>
            </View>
            {nextUrgency ? <Pill label={nextUrgency.label} tone={nextUrgency.tone} /> : null}
          </View>
        </Card>

        <Card>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotLabel}>Dinner</Text>
              <Text style={styles.snapshotValue}>{todayDinner ? todayDinner.title : "No dinner picked yet"}</Text>
              <Text style={styles.snapshotMeta}>
                {todayDinner ? "Tonight is covered." : "Use Meals or the assistant before dinner hour sneaks up."}
              </Text>
            </View>
            <Ionicons name="restaurant" size={22} color={colors.coral} />
          </View>
        </Card>

        <Card>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotLabel}>Open chores</Text>
              <Text style={styles.snapshotValue}>{openChores.length === 0 ? "All caught up" : `${openChores.length} still open`}</Text>
              <Text style={styles.snapshotMeta}>
                {nextTwoChores.length > 0
                  ? formatChorePreview(nextTwoChores, members)
                  : "Nothing left to hand off right now."}
              </Text>
            </View>
            <Ionicons name="checkmark-done" size={22} color={colors.gold} />
          </View>
        </Card>
      </View>

      <SectionTitle title="Keep moving" />
      <View style={styles.quickActionGrid}>
        {onEnterKidsMode ? (
          <Card>
            <Text style={styles.quickTitle}>Kids mode</Text>
            <Text style={styles.quickText}>Hand the phone over with a simplified, chore-focused view.</Text>
            <View style={styles.quickActionFooter}>
              <PrimaryButton label="Open kids mode" icon="happy" tone="dark" onPress={onEnterKidsMode} />
            </View>
          </Card>
        ) : null}
        {onOpenFamilySettings ? (
          <Card>
            <Text style={styles.quickTitle}>Household setup</Text>
            <Text style={styles.quickText}>Invite another adult, add child profiles, or update family settings.</Text>
            <View style={styles.quickActionFooter}>
              <PrimaryButton label="Open family" icon="people" tone="dark" onPress={onOpenFamilySettings} />
            </View>
          </Card>
        ) : null}
        {onOpenInsights ? (
          <Card>
            <Text style={styles.quickTitle}>Insights</Text>
            <Text style={styles.quickText}>Check chores momentum, busyness, and how the week is really going.</Text>
            <View style={styles.quickActionFooter}>
              <PrimaryButton label="See insights" icon="analytics" tone="dark" onPress={onOpenInsights} />
            </View>
          </Card>
        ) : null}
      </View>

      {kidsWithOpenChores.length > 0 ? (
        <>
          <SectionTitle title="Kids need eyes on this" action={`${kidStarTotal} stars total`} />
          <View style={styles.stack}>
            {kidsWithOpenChores.map(({ member, openCount }) => (
              <Card key={member.id}>
                <Row>
                  <MemberAvatar member={member} size={40} />
                  <View style={styles.fill}>
                    <Text style={styles.itemTitle}>{member.name}</Text>
                    <Text style={styles.itemMeta}>
                      {openCount} chore{openCount === 1 ? "" : "s"} open - {member.starBalance} stars saved
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
        title="Updates"
        action={unreadNotifications.length > 0 ? `${unreadNotifications.length} unread` : "All caught up"}
      />
      <View style={styles.stack}>
        {recentNotifications.length > 0 ? (
          recentNotifications.map((notification) => (
            <Card key={notification.id}>
              <Row align="flex-start">
                <View style={[styles.notificationIcon, notification.readAt ? styles.notificationIconMuted : styles.notificationIconUnread]}>
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
            <Text style={styles.emptyPanelTitle}>No updates yet.</Text>
            <Text style={styles.emptyPanelText}>
              In-app alerts appear here after reminders or digests are recorded. Push delivery to your phone is not guaranteed in this build.
            </Text>
          </Card>
        )}
      </View>

      <SectionTitle title="Dinner this week" action={`${meals.length} meals`} />
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
            <Text style={styles.emptyPanelTitle}>No dinners planned yet.</Text>
            <Text style={styles.emptyPanelText}>
              Even one or two dinners makes the week feel calmer. Start with the nights that usually get hectic.
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
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
    alignItems: "center",
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
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36
  },
  subhead: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  memberStack: {
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: spacing.md
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
    backgroundColor: colors.goldSoft,
    borderRadius: radii.lg,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  highlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  highlightCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
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
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs,
    textTransform: "uppercase"
  },
  highlightValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  },
  emptyPanel: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  emptyPanelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  emptyPanelText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  syncText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: spacing.md
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
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22
  },
  snapshotMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  quickActionGrid: {
    gap: spacing.md
  },
  quickTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  quickText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
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
    fontWeight: "900",
    lineHeight: 20
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
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
    fontWeight: "700",
    marginTop: spacing.sm
  },
  timeBlock: {
    alignItems: "center",
    minWidth: 54
  },
  time: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  }
});
