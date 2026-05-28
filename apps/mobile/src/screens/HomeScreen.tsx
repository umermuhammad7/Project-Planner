import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { TabKey } from "../types";

export function HomeScreen({ goTo }: { goTo: (tab: TabKey) => void }) {
  const {
    familyName,
    members,
    events,
    meals,
    chores,
    refreshFromBackend,
    syncSource,
    syncMessage,
    isHydrating
  } = useHomeThreadStore();
  const listItemsByListId = useHomeThreadStore((state) => state.listItemsByListId);
  const openChores = chores.filter((chore) => !chore.completed);
  const allListItems = useMemo(
    () => Object.values(listItemsByListId).flat(),
    [listItemsByListId]
  );
  const openItems = allListItems.filter((item) => !item.checked);
  const dinners = meals.filter((meal) => meal.mealType === "dinner").slice(0, 3);

  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>HomeThread</Text>
          <Text style={styles.title}>{familyName}</Text>
          <Text style={styles.subhead}>Today is covered</Text>
        </View>
        <View style={styles.memberStack}>
          {members.slice(0, 3).map((member) => (
            <MemberAvatar key={member.id} member={member} size={34} />
          ))}
        </View>
      </View>

      <Card>
        <Row align="flex-start">
          <View style={styles.heroIcon}>
            <Ionicons name="chatbubbles" size={22} color={colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Pill
              label={syncSource === "api" ? "Local backend connected" : "Prototype mode"}
              tone={syncSource === "api" ? "primary" : "neutral"}
              icon={syncSource === "api" ? "sparkles" : "information-circle"}
            />
            <Text style={styles.heroTitle}>Send the family one clean update.</Text>
            <Text style={styles.heroText}>
              {syncSource === "api"
                ? "Plans, chores, and shopping are backed by your local HomeThread database."
                : "Plans, chores, and shopping are using local prototype data. Connect the local backend to sync changes."}
            </Text>
            <Text style={styles.syncText}>{isHydrating ? "Refreshing..." : syncMessage}</Text>
          </View>
        </Row>
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
          <PrimaryButton
            label="Digest"
            icon="chatbubbles"
            onPress={() => {
              goTo("thread");
            }}
          />
          <PrimaryButton label="Quick add" icon="add" onPress={() => goTo("add")} />
        </View>
      </Card>

      <SectionTitle title="Next up" action={`${events.length} plans`} />
      <View style={styles.stack}>
        {events.slice(0, 3).map((event) => (
          <Card key={event.id}>
            <Row>
              <View style={styles.timeBlock}>
                <Text style={styles.time}>{event.time}</Text>
                <Text style={styles.date}>{event.dateLabel}</Text>
              </View>
              <View style={styles.fill}>
                <Text style={styles.itemTitle}>{event.title}</Text>
                <Text style={styles.itemMeta}>{event.location ?? "No location set"}</Text>
              </View>
              <Pill label={event.source} tone={event.source === "text" ? "coral" : "neutral"} />
            </Row>
          </Card>
        ))}
      </View>

      <SectionTitle title="Household pulse" />
      <View style={styles.metrics}>
        <Metric value={openChores.length} label="chores left" tone={colors.coralSoft} />
        <Metric value={openItems.length} label="shopping items" tone={colors.mintSoft} />
        <Metric value={members.reduce((sum, member) => sum + member.starBalance, 0)} label="kid stars" tone={colors.goldSoft} />
      </View>

      <SectionTitle title="This week for dinner" action={`${meals.length} meals`} />
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
            <Text style={styles.itemMeta}>Add a few meals so the week has a plan before dinner hour hits.</Text>
          </Card>
        )}
      </View>
    </View>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <View style={[styles.metric, { backgroundColor: tone }]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36
  },
  subhead: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4
  },
  memberStack: {
    flexDirection: "row",
    gap: spacing.xs
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27
  },
  heroText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21
  },
  syncText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  stack: {
    gap: spacing.md
  },
  timeBlock: {
    width: 72
  },
  time: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  fill: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3
  },
  metrics: {
    flexDirection: "row",
    gap: spacing.md
  },
  metric: {
    borderRadius: 16,
    flex: 1,
    padding: spacing.lg
  },
  metricValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  }
});
