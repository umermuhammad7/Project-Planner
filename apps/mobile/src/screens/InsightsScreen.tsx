import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Pill, Row, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { InsightsBusyness, InsightsChores, InsightsWeekly } from "../types";
import { safeArray } from "../utils/safeRender";

function SectionError({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{message}</Text>
    </Card>
  );
}

export function InsightsScreen({ onClose }: { onClose: () => void }) {
  const familyId = useHomeThreadStore((state) => state.familyId);
  const syncSource = useHomeThreadStore((state) => state.syncSource);
  const [weekly, setWeekly] = useState<InsightsWeekly | null>(null);
  const [chores, setChores] = useState<InsightsChores | null>(null);
  const [busyness, setBusyness] = useState<InsightsBusyness | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [choresError, setChoresError] = useState<string | null>(null);
  const [busynessError, setBusynessError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadInsights() {
    if (!familyId || syncSource !== "api") {
      setWeekly(null);
      setChores(null);
      setBusyness(null);
      setWeeklyError(null);
      setChoresError(null);
      setBusynessError(null);
      setIsLoading(false);
      setMessage("Sign in and sync your household to see insights.");
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setWeeklyError(null);
    setChoresError(null);
    setBusynessError(null);

    const [weeklyResult, choresResult, busynessResult] = await Promise.all([
      apiRequest<InsightsWeekly>(`/families/${familyId}/insights/weekly`),
      apiRequest<InsightsChores>(`/families/${familyId}/insights/chores`),
      apiRequest<InsightsBusyness>(`/families/${familyId}/insights/busyness`)
    ]);

    if (weeklyResult.data) {
      setWeekly(weeklyResult.data);
      setWeeklyError(null);
    } else {
      setWeekly(null);
      setWeeklyError(weeklyResult.error?.message ?? "Could not load this week's summary.");
    }

    if (choresResult.data) {
      setChores(choresResult.data);
      setChoresError(null);
    } else {
      setChores(null);
      setChoresError(choresResult.error?.message ?? "Could not load chore momentum.");
    }

    if (busynessResult.data) {
      setBusyness(busynessResult.data);
      setBusynessError(null);
    } else {
      setBusyness(null);
      setBusynessError(busynessResult.error?.message ?? "Could not load schedule load.");
    }

    const anyLoaded = Boolean(weeklyResult.data || choresResult.data || busynessResult.data);
    if (!anyLoaded) {
      setMessage(
        weeklyResult.error?.message ??
          choresResult.error?.message ??
          busynessResult.error?.message ??
          "Could not load insights right now."
      );
    } else {
      setMessage(null);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void loadInsights();
  }, [familyId, syncSource]);

  const topChoreMember = useMemo(() => {
    const members = safeArray(chores?.members);
    return members.slice().sort((left, right) => right.completedCount - left.completedCount)[0] ?? null;
  }, [chores]);

  const busiestDay = safeArray(busyness?.days)[0] ?? null;
  const busiestMember = safeArray(busyness?.members)[0] ?? null;
  const choreMembers = safeArray(chores?.members);
  const busynessDays = safeArray(busyness?.days);
  const hasPartialData = Boolean(weekly || chores || busyness);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="Insights"
        title="How the family is doing"
        subtitle="A quick weekly read on plans, chores, and household load."
        badgeLabel="Preview"
        badgeTone="gold"
        icon="stats-chart"
        variant="admin"
        actionLabel="Back"
        onActionPress={onClose}
      />

      {isLoading ? (
        <Card>
          <Text style={styles.cardTitle}>Loading insights...</Text>
          <Text style={styles.cardText}>Pulling the latest household summary.</Text>
        </Card>
      ) : null}

      {!isLoading && message && !hasPartialData ? (
        <Card>
          <Text style={styles.cardTitle}>Not ready yet</Text>
          <Text style={styles.cardText}>{message}</Text>
        </Card>
      ) : null}

      {!isLoading && message && hasPartialData ? (
        <Card>
          <Text style={styles.cardText}>Some insight sections could not load. The rest are still available below.</Text>
        </Card>
      ) : null}

      {weekly ? (
        <>
          <SectionTitle title="This week" />
          <View style={styles.metrics}>
            <MetricCard value={weekly.upcomingEvents} label="Upcoming plans" tone="primary" />
            <MetricCard value={weekly.openChores} label="Open chores" tone="coral" />
            <MetricCard value={weekly.plannedMeals} label="Planned meals" tone="mint" />
            <MetricCard value={weekly.unreadNotifications} label="Unread alerts" tone="gold" />
          </View>
          <Card>
            <Text style={styles.cardTitle}>Household</Text>
            <Text style={styles.cardText}>
              {weekly.activeMembers} family {weekly.activeMembers === 1 ? "member" : "members"} in this household.
            </Text>
          </Card>
        </>
      ) : !isLoading && weeklyError ? (
        <>
          <SectionTitle title="This week" />
          <SectionError title="Weekly summary unavailable" message={weeklyError} />
        </>
      ) : null}

      {chores ? (
        <>
          <SectionTitle title="Chore momentum" />
          {topChoreMember ? (
            <Card>
              <Row>
                <View style={styles.fill}>
                  <Text style={styles.cardTitle}>{topChoreMember.name}</Text>
                  <Text style={styles.cardText}>
                    {topChoreMember.completedCount} done · {topChoreMember.outstandingCount} still open ·{" "}
                    {topChoreMember.starsEarned} stars
                  </Text>
                </View>
                <Pill label="Top helper" tone="gold" />
              </Row>
            </Card>
          ) : null}
          <View style={styles.stack}>
            {choreMembers.map((member) => (
              <Card key={member.memberId}>
                <Row>
                  <View style={styles.fill}>
                    <Text style={styles.itemTitle}>{member.name}</Text>
                    <Text style={styles.itemMeta}>
                      {member.completedCount} done · {member.outstandingCount} open · {member.starsEarned} stars
                    </Text>
                  </View>
                  <Pill label={member.role} tone="neutral" />
                </Row>
              </Card>
            ))}
          </View>
        </>
      ) : !isLoading && choresError ? (
        <>
          <SectionTitle title="Chore momentum" />
          <SectionError title="Chore momentum unavailable" message={choresError} />
        </>
      ) : null}

      {busyness ? (
        <>
          <SectionTitle title="Schedule load" />
          <Card>
            <Text style={styles.cardTitle}>{busiestDay ? busiestDay.dayLabel : "Quiet week ahead"}</Text>
            <Text style={styles.cardText}>
              {busiestDay
                ? `${busiestDay.eventCount} plans make this the busiest day coming up.`
                : "No upcoming plans in the current window."}
            </Text>
            {busiestMember ? (
              <Text style={styles.helperText}>
                Most involved: {busiestMember.name} ({busiestMember.eventCount} linked plan
                {busiestMember.eventCount === 1 ? "" : "s"})
              </Text>
            ) : null}
          </Card>
          {busynessDays.length > 0 ? (
            <View style={styles.stack}>
              {busynessDays.map((day) => (
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
            <Text style={styles.cardText}>Counts refresh each time you open Insights.</Text>
          </Card>
        </>
      ) : !isLoading && busynessError ? (
        <>
          <SectionTitle title="Schedule load" />
          <SectionError title="Schedule load unavailable" message={busynessError} />
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
