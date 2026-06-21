import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { TimeField } from "../components/TimeField";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function ChoresScreen() {
  const { chores, members, completeChore, createChore, refreshFromBackend, isSaving, isHydrating, syncSource, syncMessage, realtimeStatus, realtimeMessage } =
    useHomeThreadStore();
  const { scrollToOffset, scrollToTop } = useScrollAssist();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [completionTone, setCompletionTone] = useState<"success" | "error" | "info">("success");
  const openChores = useMemo(() => chores.filter((chore) => !chore.completed), [chores]);
  const completedChores = useMemo(() => chores.filter((chore) => chore.completed), [chores]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!successMessage && !infoMessage && !completionMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setInfoMessage(null);
      setCompletionMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage, infoMessage, completionMessage]);

  function toggleForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !showForm;
    setShowForm(next);
    setErrorMessage(null);

    if (next) {
      setTimeout(() => scrollToOffset(120), 80);
    }
  }

  async function handleCreateChore() {
    if (isSaving) {
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Chore title is required.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const outcome = await createChore({ title, dueTime, assignedTo });
    if (outcome.kind === "saved") {
      const savedTitle = title.trim();
      setTitle("");
      setDueTime("");
      setAssignedTo(null);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowForm(false);
      scrollToTop();
      setSuccessMessage(`"${savedTitle}" was added to today's chores.`);
      return;
    }

    if (outcome.kind === "queued") {
      setInfoMessage(outcome.message);
      return;
    }

    setErrorMessage(outcome.message || "Could not create that chore.");
  }

  async function handleCompleteChore(choreId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const outcome = await completeChore(choreId);
    if (!outcome) {
      return;
    }

    if (outcome.kind === "failed") {
      setCompletionTone("error");
      setCompletionMessage(outcome.message);
      return;
    }

    setCompletionTone(outcome.kind === "local" ? "info" : "success");
    setCompletionMessage(outcome.message);
  }

  return (
    <View>
      <Text style={styles.title}>Around the house</Text>
      <Text style={styles.subtitle}>Small, visible wins with rewards kids can understand and adults can trust.</Text>

      <SyncStatusRow
        syncSource={syncSource}
        syncMessage={syncMessage}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
        showLiveNote
      />

      <View style={styles.primaryActionWrap}>
        <PrimaryButton
          label={showForm ? "Close chore form" : "Add chore"}
          icon={showForm ? "close" : "add"}
          tone={showForm ? "soft" : "primary"}
          onPress={toggleForm}
        />
      </View>

      <View style={styles.utilityRow}>
        <PrimaryButton
          label={isHydrating ? "Refreshing..." : "Refresh"}
          icon="sync"
          tone="ghost"
          loading={isHydrating}
          disabled={isHydrating}
          onPress={() => void refreshFromBackend()}
        />
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={completionMessage ?? ""} tone={completionTone} visible={Boolean(completionMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      {showForm ? (
        <Card>
          <Text style={styles.formTitle}>Create chore</Text>
          <TextInput
            accessibilityLabel="Chore title"
            placeholder="Title"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <TimeField label="Due time for today (optional)" value={dueTime} onChange={setDueTime} placeholder="Tap to choose a time" />
          <Text style={styles.helperNote}>Pick a time if this chore should pop up later today.</Text>
          <Text style={styles.pickerLabel}>Assign to</Text>
          <View style={styles.pickerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear assignee"
              onPress={() => setAssignedTo(null)}
            >
              <Pill label="Unassigned" tone={assignedTo === null ? "primary" : "neutral"} />
            </Pressable>
            {members.map((member) => {
              const selected = assignedTo === member.id;
              return (
                <Pressable
                  key={member.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${selected ? "Selected" : "Select"} ${member.name} as assignee`}
                  onPress={() => setAssignedTo(member.id)}
                >
                  <Pill label={member.name} tone={selected ? "primary" : "neutral"} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.formActions}>
            <PrimaryButton
              label={isSaving ? "Creating..." : "Create chore"}
              icon="checkmark"
              loading={isSaving}
              disabled={isSaving}
              onPress={() => {
                void handleCreateChore();
              }}
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Due today" />
      <View style={styles.stack}>
        {openChores.length > 0 ? (
          openChores.map((chore) => {
            const member = members.find((item) => item.id === chore.assignedTo) ?? members[0];
            return (
              <Card key={chore.id}>
                <Row>
                  <View style={styles.check}>
                    <Ionicons name="ellipse-outline" size={20} color={colors.muted} />
                  </View>
                  <View style={styles.fill}>
                    <Text style={styles.choreTitle}>{chore.title}</Text>
                    <Text style={styles.meta}>{chore.dueLabel}</Text>
                  </View>
                  <MemberAvatar member={member} size={34} />
                  <Pill label={`${chore.stars} stars`} tone="gold" icon="star" />
                </Row>
                <View style={styles.choreActions}>
                  <PrimaryButton
                    label={isSaving ? "Saving..." : "Mark done"}
                    icon="checkmark-circle"
                    tone="soft"
                    loading={isSaving}
                    disabled={isSaving}
                    onPress={() => {
                      void handleCompleteChore(chore.id);
                    }}
                  />
                </View>
              </Card>
            );
          })
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>Nothing still needs doing.</Text>
            <Text style={styles.emptyText}>
              Fresh chores will land here, while finished ones stay tucked below.
            </Text>
          </Card>
        )}
      </View>

      {completedChores.length > 0 ? (
        <>
          <SectionTitle title="Finished" action={`${completedChores.length} done`} />
          <View style={styles.stack}>
            {completedChores.map((chore) => {
              const member = members.find((item) => item.id === chore.assignedTo) ?? members[0];
              return (
                <Card key={chore.id}>
                  <Row>
                    <View style={[styles.check, styles.checkDone]}>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.fill}>
                      <Text style={[styles.choreTitle, styles.doneText]}>{chore.title}</Text>
                      <Text style={styles.meta}>{chore.dueLabel}</Text>
                    </View>
                    <MemberAvatar member={member} size={34} />
                    <Pill label="Done" tone="mint" icon="checkmark" />
                  </Row>
                </Card>
              );
            })}
          </View>
        </>
      ) : null}

      <SectionTitle title="Star balances" />
      <View style={styles.rewardGrid}>
        {members.filter((member) => member.role === "kid").length > 0 ? (
          members
            .filter((member) => member.role === "kid")
            .map((member) => (
              <Card key={member.id}>
                <View style={styles.rewardCard}>
                  <MemberAvatar member={member} />
                  <View style={styles.fill}>
                    <Text style={styles.choreTitle}>{member.name}</Text>
                    <Text style={styles.meta}>{member.starBalance} stars saved</Text>
                  </View>
                </View>
              </Card>
            ))
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>No child profiles yet.</Text>
            <Text style={styles.emptyText}>
              Add a child profile from Household so stars and kids mode feel personal from day one.
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: spacing.sm
  },
  primaryActionWrap: {
    marginTop: spacing.lg
  },
  utilityRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm
  },
  formTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md,
    marginTop: spacing.sm
  },
  helperNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  formActions: {
    marginTop: spacing.lg
  },
  pickerLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.lg
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  stack: {
    gap: spacing.md
  },
  fill: {
    flex: 1
  },
  choreActions: {
    marginTop: spacing.md
  },
  check: {
    alignItems: "center",
    backgroundColor: "#F1ECE5",
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  checkDone: {
    backgroundColor: colors.mint
  },
  choreTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  doneText: {
    color: colors.muted,
    textDecorationLine: "line-through"
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  rewardGrid: {
    gap: spacing.md
  },
  rewardCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: spacing.sm
  }
});
