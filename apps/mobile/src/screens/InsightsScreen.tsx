import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Pill, Row, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { InsightsBusyness, InsightsChores, InsightsWeekly } from "../types";

export function InsightsScreen({ onClose }: { onClose: () => void }) {
  const familyId = useHomeThreadStore((state) => state.familyId);
  const syncSource = useHomeThreadStore((state) => state.syncSource);
  const [weekly, setWeekly] = useState<InsightsWeekly | null>(null);
  const [chores, setChores] = useState<InsightsChores | null>(null);
  const [busyness, setBusyness] = useState<InsightsBusyness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadInsights() {
    if (!familyId || syncSource !== "api") {
      setWeekly(null);
      setChores(null);
      setBusyness(null);
      setIsLoading(false);
      setMessage("Sign in and sync your household to see insights.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const [weeklyResult, choresResult, busynessResult] = await Promise.all([
      apiRequest<InsightsWeekly>(`/families/${familyId}/insights/weekly`),
      apiRequest<InsightsChores>(`/families/${familyId}/insights/chores`),
      apiRequest<InsightsBusyness>(`/families/${familyId}/insights/busyness`)
    ]);

    if (!weeklyResult.data || !choresResult.data || !busynessResult.data) {
      setMessage(
        weeklyResult.error?.message ??
          choresResult.error?.message ??
          busynessResult.error?.message ??
          "Could not load insights right now."
      );
      setWeekly(null);
      setChores(null);
      setBusyness(null);
      setIsLoading(false);
      return;
    }

    setWeekly(weeklyResult.data);
    setChores(choresResult.data);
    setBusyness(busynessResult.data);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadInsights();
  }, [familyId, syncSource]);

  const topChoreMember = useMemo(() => {
    return chores?.members.slice().sort((left, right) => right.completedCount - left.completedCount)[0] ?? null;
  }, [chores]);

  const busiestDay = busyness?.days[0] ?? null;
  const busiestMember = busyness?.members[0] ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Insights</Text>
          <Text style={styles.title}>How the family is doing</Text>
          <Text style={styles.subtitle}>A compact weekly read on plans, chores, and household load.</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Card>
          <Text style={styles.cardTitle}>Loading insights...</Text>
          <Text style={styles.cardText}>Pulling the latest household summary.</Text>
        </Card>
      ) : null}

      {message ? (
        <Card>
          <Text style={styles.cardTitle}>Not ready yet</Text>
          <Text style={styles.cardText}>{message}</Text>
        </Card>
      ) : null}

      {weekly ? (
        <>
          <SectionTitle title="This week" action={`${weekly.windowDays} day window`} />
          <View style={styles.metrics}>
            <MetricCard value={weekly.upcomingEvents} label="upcoming events" tone="primary" />
            <MetricCard value={weekly.openChores} label="open chores" tone="coral" />
            <MetricCard value={weekly.plannedMeals} label="planned meals" tone="mint" />
            <MetricCard value={weekly.unreadNotifications} label="unread alerts" tone="gold" />
          </View>
          <Card>
            <Text style={styles.cardTitle}>Household coverage</Text>
            <Text style={styles.cardText}>
              {weekly.activeMembers} active family members are part of this household right now.
            </Text>
          </Card>
        </>
      ) : null}

      {chores ? (
        <>
          <SectionTitle title="Chore momentum" action={`${chores.windowDays} days`} />
          {topChoreMember ? (
            <Card>
              <Row>
                <View style={styles.fill}>
                  <Text style={styles.cardTitle}>{topChoreMember.name}</Text>
                  <Text style={styles.cardText}>
                    {topChoreMember.completedCount} chores finished, {topChoreMember.outstandingCount} still assigned,{" "}
                    {topChoreMember.starsEarned} stars earned.
                  </Text>
                </View>
                <Pill label="Top helper" tone="gold" />
              </Row>
            </Card>
          ) : null}
          <View style={styles.stack}>
            {chores.members.map((member) => (
              <Card key={member.memberId}>
                <Row>
                  <View style={styles.fill}>
                    <Text style={styles.itemTitle}>{member.name}</Text>
                    <Text style={styles.itemMeta}>
                      {member.completedCount} completed - {member.outstandingCount} assigned - {member.starsEarned} stars
                    </Text>
                  </View>
                  <Pill label={member.role} tone="neutral" />
                </Row>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {busyness ? (
        <>
          <SectionTitle title="Schedule load" action={`${busyness.windowDays} days`} />
          <Card>
            <Text style={styles.cardTitle}>{busiestDay ? busiestDay.dayLabel : "No busy day yet"}</Text>
            <Text style={styles.cardText}>
              {busiestDay
                ? `${busiestDay.eventCount} events make this the busiest upcoming day.`
                : "No upcoming events are scheduled in the current window."}
            </Text>
            {busiestMember ? (
              <Text style={styles.helperText}>
                Most involved member: {busiestMember.name} with {busiestMember.eventCount} linked event
                {busiestMember.eventCount === 1 ? "" : "s"}.
              </Text>
            ) : null}
          </Card>
          {busyness.days.length > 0 ? (
            <View style={styles.stack}>
              {busyness.days.map((day) => (
                <Card key={day.dayLabel}>
                  <Row>
                    <Text style={styles.itemTitle}>{day.dayLabel}</Text>
                    <View style={styles.fill} />
                    <Pill label={`${day.eventCount} event${day.eventCount === 1 ? "" : "s"}`} tone="primary" />
                  </Row>
                </Card>
              ))}
            </View>
          ) : null}
          <Card>
            <Text style={styles.cardText}>
              Counts refresh when you open this screen, not on a fixed schedule.
            </Text>
          </Card>
        </>
      ) : null}
    </View>
  );
}

function MetricCard({
  value,
  label,
  tone
}: {
  value: number;
  label: string;
  tone: "primary" | "coral" | "mint" | "gold";
}) {
  return (
    <View style={[styles.metricCard, toneStyles[tone]]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const toneStyles = {
  primary: { backgroundColor: colors.primarySoft },
  coral: { backgroundColor: colors.coralSoft },
  mint: { backgroundColor: colors.mintSoft },
  gold: { backgroundColor: colors.goldSoft }
} as const;

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  closeLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    borderRadius: radii.md,
    minWidth: "47%",
    padding: spacing.lg
  },
  metricValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "700"
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  helperText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.md
  },
  stack: {
    gap: spacing.md
  },
  fill: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3
  }
});
