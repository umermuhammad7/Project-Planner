import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, FieldError, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { TimeField } from "../components/TimeField";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";

export function ChoresScreen() {
  const {
    chores,
    members,
    completeChore,
    createChore,
    updateChore,
    deleteChore,
    refreshFromBackend,
    isHydrating,
    syncSource,
    syncMessage,
    realtimeStatus,
    realtimeMessage
  } = useHomeThreadStore();
  const isSavingChores = useHomeThreadStore(isHomeThreadSavingScope("chores"));
  const { scrollToOffset, scrollToTop } = useScrollAssist();
  const [showForm, setShowForm] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [pendingDeleteChoreId, setPendingDeleteChoreId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [completionTone, setCompletionTone] = useState<"success" | "error" | "info">("success");
  const [titleError, setTitleError] = useState<string | null>(null);
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

  function resetForm() {
    setTitle("");
    setDueTime("");
    setAssignedTo(null);
    setEditingChoreId(null);
    setTitleError(null);
    setErrorMessage(null);
  }

  function openCreateForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    resetForm();
    setShowForm(true);
    setTimeout(() => scrollToOffset(120), 80);
  }

  function openEditForm(chore: (typeof chores)[number]) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingChoreId(chore.id);
    setTitle(chore.title);
    setDueTime(choreDueTimeForField(chore.dueTime));
    setAssignedTo(chore.assignedTo === "unassigned" ? null : chore.assignedTo);
    setShowForm(true);
    setPendingDeleteChoreId(null);
    setTitleError(null);
    setErrorMessage(null);
    setTimeout(() => scrollToOffset(120), 80);
  }

  function toggleForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (showForm) {
      setShowForm(false);
      resetForm();
      return;
    }

    openCreateForm();
  }

  async function handleSaveChore() {
    if (isSavingChores) {
      return;
    }

    if (!title.trim()) {
      setTitleError("Chore title is required.");
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);
    setTitleError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const wasEditing = Boolean(editingChoreId);
    const outcome = editingChoreId
      ? await updateChore({
          choreId: editingChoreId,
          title,
          dueTime,
          assignedTo
        })
      : await createChore({ title, dueTime, assignedTo });

    if (outcome.kind === "saved") {
      const savedTitle = title.trim();
      resetForm();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowForm(false);
      scrollToTop();
      setSuccessMessage(
        wasEditing ? `"${savedTitle}" was updated.` : `"${savedTitle}" was added to open chores.`
      );
      return;
    }

    if (outcome.kind === "queued" || outcome.kind === "local") {
      setInfoMessage(outcome.message);
      if (outcome.kind === "local" && editingChoreId) {
        resetForm();
        setShowForm(false);
      }
      return;
    }

    setErrorMessage(outcome.message || "Could not save that chore.");
  }

  async function handleDeleteChore(choreId: string, choreTitle: string) {
    if (isSavingChores) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    const outcome = await deleteChore(choreId);
    setPendingDeleteChoreId(null);

    if (outcome.kind === "saved" || outcome.kind === "local") {
      if (editingChoreId === choreId) {
        resetForm();
        setShowForm(false);
      }
      setSuccessMessage(`"${choreTitle}" was removed.`);
      return;
    }

    if (outcome.kind === "queued") {
      setInfoMessage(outcome.message);
      return;
    }

    setErrorMessage(outcome.message || "Could not remove that chore.");
  }

  async function handleCompleteChore(choreId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const outcome = await completeChore(choreId);
    if (!outcome) {
      setCompletionTone("error");
      setCompletionMessage("Could not find that chore.");
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
      <ScreenHeader
        eyebrow="Chores"
        title="Household chores"
        subtitle="Daily assignments with optional due times. Mark done when finished today."
        badgeLabel={`${openChores.length} open`}
        badgeTone={openChores.length > 0 ? "gold" : "neutral"}
        density="compact"
      />

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
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      {showForm ? (
        <Card>
          <Text style={styles.formTitle}>{editingChoreId ? "Edit chore" : "Create chore"}</Text>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            accessibilityLabel="Chore title"
            placeholder="Title"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              if (titleError) {
                setTitleError(null);
              }
            }}
            style={[styles.input, titleError ? styles.inputInvalid : null]}
          />
          <FieldError message={titleError} />
          <TimeField label="Daily due time (optional)" value={dueTime} onChange={setDueTime} placeholder="Tap to choose a time" />
          <Text style={styles.helperNote}>Chores repeat daily. Add a time if you want a reminder nudge each day.</Text>
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
              label={isSavingChores ? "Saving..." : editingChoreId ? "Save changes" : "Create chore"}
              icon="checkmark"
              loading={isSavingChores}
              disabled={isSavingChores}
              onPress={() => {
                void handleSaveChore();
              }}
            />
            {editingChoreId ? (
              <PrimaryButton
                label="Cancel edit"
                icon="close"
                tone="ghost"
                disabled={isSavingChores}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowForm(false);
                  resetForm();
                }}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Open chores" action={`${openChores.length} open`} />
      <ActionFeedback message={completionMessage ?? ""} tone={completionTone} visible={Boolean(completionMessage)} />
      <View style={styles.stack}>
        {openChores.length > 0 ? (
          openChores.map((chore) => {
            const member = members.find((item) => item.id === chore.assignedTo);
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
                  {member ? <MemberAvatar member={member} size={34} /> : null}
                  <Pill label={`${chore.stars} stars`} tone="gold" icon="star" />
                </Row>
                <View style={styles.choreActions}>
                  <PrimaryButton
                    label={isSavingChores ? "Saving..." : "Mark done"}
                    icon="checkmark-circle"
                    loading={isSavingChores}
                    disabled={isSavingChores}
                    onPress={() => {
                      void handleCompleteChore(chore.id);
                    }}
                  />
                  <PrimaryButton
                    label="Edit"
                    icon="create"
                    tone="soft"
                    disabled={isSavingChores}
                    onPress={() => openEditForm(chore)}
                  />
                  {pendingDeleteChoreId === chore.id ? (
                    <View style={styles.inlineConfirm}>
                      <Text style={styles.confirmText}>Remove "{chore.title}"?</Text>
                      <View style={styles.inlineConfirmActions}>
                        <PrimaryButton
                          label="Keep"
                          icon="close"
                          tone="ghost"
                          disabled={isSavingChores}
                          onPress={() => setPendingDeleteChoreId(null)}
                        />
                        <PrimaryButton
                          label={isSavingChores ? "Removing..." : "Remove"}
                          icon="trash"
                          tone="dark"
                          loading={isSavingChores}
                          disabled={isSavingChores}
                          onPress={() => {
                            void handleDeleteChore(chore.id, chore.title);
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <PrimaryButton
                      label="Delete"
                      icon="trash"
                      tone="ghost"
                      disabled={isSavingChores}
                      onPress={() => setPendingDeleteChoreId(chore.id)}
                    />
                  )}
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
              const member = members.find((item) => item.id === chore.assignedTo);
              return (
                <View key={chore.id} style={styles.completedRow}>
                  <View style={[styles.check, styles.checkDone]}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.fill}>
                    <Text style={[styles.choreTitle, styles.doneText]}>{chore.title}</Text>
                    <Text style={styles.meta}>{chore.dueLabel}</Text>
                  </View>
                  {member ? <MemberAvatar member={member} size={30} /> : null}
                </View>
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

function choreDueTimeForField(dueTime?: string | null) {
  if (!dueTime) {
    return "";
  }

  const match = /^(\d{2}):(\d{2})/u.exec(dueTime);
  return match ? `${match[1]}:${match[2]}` : "";
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
    marginBottom: spacing.sm
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md,
    marginTop: spacing.xs
  },
  inputInvalid: {
    borderColor: colors.coral
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
  completedRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    opacity: 0.72,
    paddingVertical: spacing.sm
  },
  fill: {
    flex: 1
  },
  choreActions: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  inlineConfirm: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  inlineConfirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  confirmText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
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
