import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";

const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayDayOfWeek() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

export function KidsModeScreen({ onExit }: { onExit: () => void }) {
  const { chores, members, events, meals, completeChore, refreshFromBackend, isSaving, saveMessage } =
    useHomeThreadStore();

  const kidMembers = useMemo(() => members.filter((member) => member.role === "kid"), [members]);
  const kidIds = useMemo(() => new Set(kidMembers.map((member) => member.id)), [kidMembers]);

  const kidChores = useMemo(
    () => chores.filter((chore) => kidIds.has(chore.assignedTo)),
    [chores, kidIds]
  );
  const openKidChores = useMemo(() => kidChores.filter((chore) => !chore.completed), [kidChores]);
  const doneKidChores = useMemo(() => kidChores.filter((chore) => chore.completed), [kidChores]);

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

  async function markDone(choreId: string) {
    await completeChore(choreId);
    void refreshFromBackend();
  }

  return (
    <View style={styles.root}>
      <View style={styles.modeBanner}>
        <Pill label="Kids mode" tone="mint" icon="happy" />
        <Text style={styles.modeNote}>A simpler view for kids. Tap below when a grown-up is ready to switch back.</Text>
      </View>

      <PrimaryButton label="Back for grown-ups" icon="arrow-back" tone="dark" onPress={onExit} />

      <Text style={styles.greeting}>You&apos;ve got this today</Text>

      <SectionTitle title="Your stars" />
      <View style={styles.starGrid}>
        {kidMembers.length > 0 ? (
          kidMembers.map((member) => (
            <View key={member.id} style={[styles.starCard, { backgroundColor: member.color }]}>
              <MemberAvatar member={member} size={52} />
              <Text style={styles.starName}>{member.name}</Text>
              <View style={styles.starRow}>
                <Ionicons name="star" size={28} color={colors.gold} />
                <Text style={styles.starValue}>{member.starBalance}</Text>
              </View>
              <Text style={styles.starCaption}>stars saved</Text>
            </View>
          ))
        ) : (
          <Card>
            <Text style={styles.emptyText}>No kid profiles in this family yet.</Text>
          </Card>
        )}
      </View>

      <SectionTitle title="Chores to do" action={`${openKidChores.length} left`} />
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
                  <Pill label={`+${chore.stars}`} tone="gold" icon="star" />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${chore.title} done`}
                  disabled={isSaving}
                  onPress={() => void markDone(chore.id)}
                  style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
                >
                  <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
                  <Text style={styles.doneButtonText}>{isSaving ? "Saving..." : "Done!"}</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>All done for now</Text>
            <Text style={styles.emptyText}>Nice work - check back if a grown-up adds more chores.</Text>
          </Card>
        )}
      </View>

      {doneKidChores.length > 0 ? (
        <>
          <SectionTitle title="Finished today" />
          <View style={styles.doneStack}>
            {doneKidChores.map((chore) => (
              <Card key={chore.id}>
                <Text style={styles.doneChoreTitle}>{chore.title}</Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {nextEvent || tonightDinner ? (
        <>
          <SectionTitle title="Heads up" />
          <View style={styles.headsupStack}>
            {nextEvent ? (
              <Card>
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
              </Card>
            ) : null}
            {tonightDinner ? (
              <Card>
                <View style={styles.headsupRow}>
                  <Ionicons name="restaurant" size={22} color={colors.coral} />
                  <View style={styles.headsupCopy}>
                    <Text style={styles.headsupLabel}>Dinner tonight</Text>
                    <Text style={styles.headsupTitle}>{tonightDinner.title}</Text>
                    <Text style={styles.headsupMeta}>{dayLabels[tonightDinner.dayOfWeek] ?? "Today"}</Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </View>
        </>
      ) : null}

      {saveMessage ? <Text style={styles.status}>{saveMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg
  },
  modeBanner: {
    backgroundColor: colors.mintSoft,
    borderColor: colors.mint,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  modeNote: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  greeting: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32
  },
  starGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  starCard: {
    alignItems: "center",
    borderRadius: radii.lg,
    flexGrow: 1,
    minWidth: "46%",
    padding: spacing.lg
  },
  starName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  starRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  starValue: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900"
  },
  starCaption: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.xs
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
    gap: spacing.sm
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
