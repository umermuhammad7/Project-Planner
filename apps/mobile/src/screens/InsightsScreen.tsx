import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from "react-native";

import { Card, ModuleTile, Pill, Row, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
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

export function InsightsScreen({
  onClose,
  pinnedHeader = false
}: {
  onClose: () => void;
  pinnedHeader?: boolean;
}) {
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
  const [activeModule, setActiveModule] = useState<"chores" | "busyness" | null>(null);
  const scrollAssist = useScrollAssist();

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  function toggleModule(module: "chores" | "busyness") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willExpand = activeModule !== module;
    setActiveModule((current) => (current === module ? null : module));
    if (willExpand) {
      // These modules always render last on the screen, so once the newly revealed
      // content mounts, scrolling to the very end reliably brings it into view —
      // measuring a specific node's position (scrollIntoView) was not firing on web.
      setTimeout(() => scrollAssist.scrollToBottom(), 260);
    }
  }

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
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>📊</Text>
          </View>
          <Text style={styles.largeTitleText}>Insights</Text>
        </View>
      ) : (
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
      )}

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
          <Card>
            <View style={styles.metrics}>
              <MetricCard value={weekly.upcomingEvents} label="Upcoming plans" icon="🗓️" tone="primary" />
              <MetricCard value={weekly.openChores} label="Open chores" icon="🧹" tone="coral" />
              <MetricCard value={weekly.plannedMeals} label="Planned meals" icon="🍽️" tone="mint" />
              <MetricCard value={weekly.unreadNotifications} label="Unread alerts" icon="🔔" tone="gold" />
            </View>
            <View style={styles.weekDivider} />
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

      {chores || busyness ? (
        <Card>
          <Text style={styles.detailsLabel}>Details</Text>
          <View style={styles.moduleRow}>
            {chores ? (
              <ModuleTile
                emoji="🧹"
                tone="gold"
                label="Chore momentum"
                meta={topChoreMember ? `Top: ${topChoreMember.name}` : "No activity yet"}
                active={activeModule === "chores"}
                onPress={() => toggleModule("chores")}
              />
            ) : null}
            {busyness ? (
              <ModuleTile
                emoji="🗓️"
                tone="primary"
                label="Schedule load"
                meta={busiestDay ? `Busiest: ${busiestDay.dayLabel}` : "Quiet week"}
                active={activeModule === "busyness"}
                onPress={() => toggleModule("busyness")}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {activeModule === "chores" && chores ? (
        <View style={styles.detailStack}>
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
              <View key={member.memberId} style={styles.itemTile}>
                <View style={[styles.itemIconTile, member.role === "child" ? styles.itemIconMint : styles.itemIconPrimary]}>
                  <Text style={styles.itemIconGlyph}>{member.role === "child" ? "🧒" : "🧹"}</Text>
                </View>
                <View style={styles.fill}>
                  <Text style={styles.itemTitle}>{member.name}</Text>
                  <Text style={styles.itemMeta}>
                    {member.completedCount} done · {member.outstandingCount} open · {member.starsEarned} stars
                  </Text>
                </View>
                <Pill label={formatMemberRole(member.role)} tone="neutral" />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!isLoading && choresError ? (
        <>
          <SectionTitle title="Chore momentum" />
          <SectionError title="Chore momentum unavailable" message={choresError} />
        </>
      ) : null}

      {activeModule === "busyness" && busyness ? (
        <View style={styles.detailStack}>
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
                <View key={day.dayLabel} style={styles.itemTile}>
                  <View style={[styles.itemIconTile, styles.itemIconPrimary]}>
                    <Text style={styles.itemIconGlyph}>🗓️</Text>
                  </View>
                  <Text style={styles.itemTitle}>{day.dayLabel}</Text>
                  <View style={styles.fill} />
                  <Pill label={`${day.eventCount} event${day.eventCount === 1 ? "" : "s"}`} tone="primary" />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {!isLoading && busynessError ? (
        <>
          <SectionTitle title="Schedule load" />
          <SectionError title="Schedule load unavailable" message={busynessError} />
        </>
      ) : null}

      {!isLoading && hasPartialData ? (
        <View style={styles.footerNote}>
          <Ionicons name="sync-outline" size={13} color={colors.muted} />
          <Text style={styles.footerNoteText}>Insights refresh every time you open this screen.</Text>
        </View>
      ) : null}
    </View>
  );
}

function MetricCard({
  value,
  label,
  icon,
  tone
}: {
  value: number;
  label: string;
  icon: string;
  tone: "primary" | "coral" | "mint" | "gold";
}) {
  return (
    <View style={[styles.metricCard, toneStyles[tone]]}>
      <View style={styles.metricIcon}>
        <Text style={styles.metricIconGlyph}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatMemberRole(role: string) {
  if (role === "admin") return "Admin";
  if (role === "child") return "Child";
  return "Member";
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
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  detailsLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    textTransform: "uppercase"
  },
  moduleRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  detailStack: {
    gap: spacing.md
  },
  footerNote: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs
  },
  footerNoteText: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center"
  },
  weekDivider: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginBottom: spacing.md,
    marginTop: spacing.md
  },
  metricCard: {
    borderRadius: radii.md,
    minWidth: "47%",
    padding: spacing.lg
  },
  metricIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 32
  },
  metricIconGlyph: {
    fontSize: 16
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
    gap: spacing.xs
  },
  fill: {
    flex: 1
  },
  itemTile: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  itemIconTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  itemIconPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.14)"
  },
  itemIconMint: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(45,170,132,0.16)"
  },
  itemIconGlyph: {
    fontSize: 14
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
