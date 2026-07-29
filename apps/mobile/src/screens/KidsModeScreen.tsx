import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, MemberAvatar, ModuleTile, Pill } from "../components/Primitives";
import { RewardCelebrationBanner, useRewardCelebration } from "../components/RewardCelebration";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";
import { feedbackToneForOutcome } from "../utils/saveOutcome";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";
import { computeRewardProgress } from "../utils/rewardProgress";

const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayDayOfWeek() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

export function KidsModeScreen({
  activeKidMemberId,
  onExit,
  pinnedHeader = false,
  exitHintVisible: pinnedExitHintVisible = false
}: {
  activeKidMemberId: string;
  onExit: () => void;
  pinnedHeader?: boolean;
  exitHintVisible?: boolean;
}) {
  const { chores, members, events, meals, completeChore, refreshFromBackend } =
    useHomeThreadStore();
  const isSavingChores = useHomeThreadStore(isHomeThreadSavingScope("chores"));
  const [activeModule, setActiveModule] = useState<"stars" | "chores" | "headsup" | null>("chores");
  const [localExitHintVisible, setLocalExitHintVisible] = useState(false);
  const exitHintVisible = pinnedHeader ? pinnedExitHintVisible : localExitHintVisible;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">("success");
  const { celebration, scale: celebrationScale, opacity: celebrationOpacity, triggerCelebration } =
    useRewardCelebration();

  const activeKid = useMemo(
    () => members.find((member) => member.id === activeKidMemberId) ?? null,
    [activeKidMemberId, members]
  );
  const kidMembers = useMemo(
    () => (activeKid ? [activeKid] : []),
    [activeKid]
  );
  const kidIds = useMemo(() => new Set([activeKidMemberId]), [activeKidMemberId]);

  const kidChores = useMemo(
    () => chores.filter((chore) => kidIds.has(chore.assignedTo)),
    [chores, kidIds]
  );
  const openKidChores = useMemo(() => kidChores.filter((chore) => !chore.completed), [kidChores]);
  const doneKidChores = useMemo(() => kidChores.filter((chore) => chore.completed), [kidChores]);
  const openKidStars = useMemo(
    () => openKidChores.reduce((sum, chore) => sum + chore.stars, 0),
    [openKidChores]
  );
  const totalKidStars = useMemo(
    () => kidMembers.reduce((sum, member) => sum + member.starBalance, 0),
    [kidMembers]
  );
  const rewardProgress = useMemo(
    () =>
      kidMembers.map((member) => ({
        member,
        ...computeRewardProgress(member.starBalance)
      })),
    [kidMembers]
  );

  const nextEvent = useMemo(
    () =>
      [...events]
        .sort(compareEventsByStartAt)
        .find((event) => getEventUrgency(event)?.label !== "Past"),
    [events]
  );

  const tonightDinner = useMemo(() => {
    const today = todayDayOfWeek();
    return meals.find((meal) => meal.dayOfWeek === today && meal.mealType === "dinner");
  }, [meals]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  function toggleModule(module: "stars" | "chores" | "headsup") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveModule((current) => (current === module ? null : module));
  }

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timer = setTimeout(() => setStatusMessage(null), statusTone === "error" ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [statusMessage, statusTone]);

  async function markDone(choreId: string, stars: number) {
    const outcome = await completeChore(choreId);
    if (!outcome) {
      setStatusTone("error");
      setStatusMessage("That chore could not be completed right now.");
      return;
    }

    setStatusTone(feedbackToneForOutcome(outcome.kind));
    setStatusMessage(outcome.message);
    if (outcome.kind !== "failed") {
      triggerCelebration(stars);
      void refreshFromBackend();
    }
  }

  return (
    <View style={styles.root}>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>🧒</Text>
          </View>
          <Text style={styles.largeTitleText}>Kids mode</Text>
        </View>
      ) : (
        <View style={styles.topRow}>
          <Pill label="Kids mode" tone="mint" icon="happy" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold to exit kids mode"
            delayLongPress={900}
            onLongPress={onExit}
            onPress={() => setLocalExitHintVisible(true)}
            style={({ pressed }) => [styles.exitChip, pressed && styles.exitChipPressed]}
          >
            <Ionicons name="lock-closed" size={14} color={colors.ink} />
            <Text style={styles.exitChipText}>Hold to exit</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.sessionNote}>
        Signed in on a parent's device - hand it back to a parent when this turn is done.
      </Text>

      <Card>
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{activeKid ? `${activeKid.name}'s turn` : "Your turn today"}</Text>
            <Text style={styles.heroNote}>Chores done, stars earned.</Text>
            {exitHintVisible ? (
              <Text style={styles.exitHint}>Keep holding the lock to leave kids mode. Parent PIN unlock is coming later.</Text>
            ) : null}
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="star" size={22} color={colors.gold} />
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardGold]}>
            <Text style={styles.summaryLabel}>Stars</Text>
            <Text style={styles.summaryValue}>{totalKidStars}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
            <Text style={styles.summaryLabel}>To earn</Text>
            <Text style={styles.summaryValue}>{openKidStars}</Text>
            <Text style={styles.summaryMeta}>{openKidChores.length} open</Text>
          </View>
        </View>

        <View style={styles.moduleRow}>
          <ModuleTile
            emoji="⭐"
            tone="gold"
            label="Stars"
            meta={`${totalKidStars} earned`}
            active={activeModule === "stars"}
            onPress={() => toggleModule("stars")}
          />
          <ModuleTile
            emoji="✅"
            tone="mint"
            label="Chores"
            meta={`${openKidChores.length} open`}
            active={activeModule === "chores"}
            onPress={() => toggleModule("chores")}
          />
          {nextEvent || tonightDinner ? (
            <ModuleTile
              emoji="📅"
              tone="primary"
              label="Heads up"
              meta={`${(nextEvent ? 1 : 0) + (tonightDinner ? 1 : 0)} update${
                (nextEvent ? 1 : 0) + (tonightDinner ? 1 : 0) === 1 ? "" : "s"
              }`}
              active={activeModule === "headsup"}
              onPress={() => toggleModule("headsup")}
            />
          ) : null}
        </View>
      </Card>

      {activeModule === "stars" ? (
        <>
      <Card>
        <View style={styles.moduleCardHeader}>
          <Text style={styles.moduleCardTitle}>Stars</Text>
          <Text style={styles.moduleCardMeta}>{totalKidStars} total</Text>
        </View>
        {kidMembers.length > 0 ? (
          rewardProgress.map(({ member, nextTarget, distance, progress }) => (
            <View key={member.id}>
              <View style={styles.rewardHeader}>
                <View style={styles.rewardLead}>
                  <MemberAvatar member={member} size={48} />
                  <View style={styles.rewardCopy}>
                    <Text style={styles.rewardName}>{member.name}</Text>
                    <Text style={styles.rewardMeta}>
                      {distance === 0
                        ? "Reward ready"
                        : `${distance} more star${distance === 1 ? "" : "s"} to the next reward`}
                    </Text>
                  </View>
                </View>
                <Pill label={`${member.starBalance} stars`} tone="gold" icon="star" />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Now</Text>
                <Text style={styles.progressLabel}>Next reward at {nextTarget}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>This child profile is no longer in the household.</Text>
        )}
      </Card>
        </>
      ) : null}

      {activeModule === "chores" ? (
        <>
      <Card>
        <View style={styles.moduleCardHeader}>
          <Text style={styles.moduleCardTitle}>Chores to do</Text>
          <Text style={styles.moduleCardMeta}>{openKidChores.length} left</Text>
        </View>
        <ActionFeedback message={statusMessage ?? ""} tone={statusTone} visible={Boolean(statusMessage)} />
        <RewardCelebrationBanner celebration={celebration} scale={celebrationScale} opacity={celebrationOpacity} />
        <View style={styles.choreStack}>
          {openKidChores.length > 0 ? (
            openKidChores.map((chore) => {
              const member = members.find((item) => item.id === chore.assignedTo) ?? kidMembers[0];
              if (!member) {
                return null;
              }

              return (
                <View key={chore.id} style={styles.choreCard}>
                  <View style={styles.choreHeader}>
                    <MemberAvatar member={member} size={44} />
                    <View style={styles.choreCopy}>
                      <Text style={styles.choreTitle}>{chore.title}</Text>
                      <Text style={styles.choreMeta}>{chore.dueLabel}</Text>
                    </View>
                    <Pill label={`+${chore.stars} stars`} tone="gold" icon="star" />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${chore.title} done`}
                    disabled={isSavingChores}
                    onPress={() => void markDone(chore.id, chore.stars)}
                    style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
                  >
                    <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
                    <Text style={styles.doneButtonText}>{isSavingChores ? "Saving..." : "Done!"}</Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View>
              <Text style={styles.emptyTitle}>All done for now</Text>
              <Text style={styles.emptyText}>Nice work. Check back if a grown-up adds more chores.</Text>
            </View>
          )}
        </View>

        {doneKidChores.length > 0 ? (
          <>
            <View style={[styles.moduleCardHeader, styles.moduleSubHeader]}>
              <Text style={styles.moduleCardTitle}>Finished today</Text>
              <Text style={styles.moduleCardMeta}>{doneKidChores.length} done</Text>
            </View>
            <View style={styles.doneStack}>
              {doneKidChores.map((chore) => (
                <View key={chore.id} style={styles.doneRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
                  <Text style={styles.doneChoreTitle}>{chore.title}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Card>
        </>
      ) : null}

      {activeModule === "headsup" && (nextEvent || tonightDinner) ? (
        <>
      <Card>
        <View style={styles.moduleCardHeader}>
          <Text style={styles.moduleCardTitle}>Heads up</Text>
        </View>
        <View style={styles.headsupStack}>
          {nextEvent ? (
            <View style={styles.headsupRow}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
              <View style={styles.headsupCopy}>
                <Text style={styles.headsupLabel}>Next plan</Text>
                <Text style={styles.headsupTitle}>{nextEvent.title}</Text>
                <Text style={styles.headsupMeta}>
                  {nextEvent.dateLabel} - {nextEvent.time}
                </Text>
              </View>
            </View>
          ) : null}
          {tonightDinner ? (
            <View style={[styles.headsupRow, nextEvent && styles.headsupRowDivider]}>
              <Ionicons name="restaurant" size={22} color={colors.coral} />
              <View style={styles.headsupCopy}>
                <Text style={styles.headsupLabel}>Dinner tonight</Text>
                <Text style={styles.headsupTitle}>{tonightDinner.title}</Text>
                <Text style={styles.headsupMeta}>{dayLabels[tonightDinner.dayOfWeek] ?? "Today"}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Card>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  // Large title (collapses into the pinned bar on scroll)
  largeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center"
  },
  largeTitleIcon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
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
  sessionNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  // Tap-to-expand module tiles (same interaction as Household's widget tiles)
  moduleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  moduleCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  moduleSubHeader: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md
  },
  moduleCardTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700"
  },
  moduleCardMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  headsupRowDivider: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md
  },
  exitChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  exitChipPressed: {
    opacity: 0.84
  },
  exitChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  heroPanel: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  greeting: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38
  },
  heroNote: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21
  },
  exitHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  heroBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.goldSoft,
    borderRadius: radii.lg,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  summaryCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: spacing.md
  },
  summaryCardGold: {
    backgroundColor: colors.goldSoft,
    borderColor: "rgba(193,125,60,0.24)"
  },
  summaryCardPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.16)"
  },
  summaryLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  rewardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  rewardLead: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md
  },
  rewardCopy: {
    flex: 1,
    gap: 2
  },
  rewardName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  rewardMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  progressTrack: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    height: 10,
    marginTop: spacing.md,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  progressLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700"
  },
  choreStack: {
    gap: spacing.md
  },
  choreCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  choreHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  choreCopy: {
    flex: 1
  },
  choreTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24
  },
  choreMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2
  },
  doneButton: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: spacing.md
  },
  doneButtonPressed: {
    opacity: 0.9
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900"
  },
  doneStack: {
    gap: spacing.xs
  },
  doneRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    opacity: 0.75,
    paddingVertical: spacing.sm
  },
  doneChoreTitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
    textDecorationLine: "line-through"
  },
  headsupStack: {
    gap: spacing.md
  },
  headsupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  headsupCopy: {
    flex: 1
  },
  headsupLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  headsupTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2
  },
  headsupMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.sm
  },
  status: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  }
});
