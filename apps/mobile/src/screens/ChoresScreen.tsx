import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { FieldError, MemberAvatar, Pill, PrimaryButton } from "../components/Primitives";
import { RewardCelebrationBanner, useRewardCelebration } from "../components/RewardCelebration";
import { TimeField } from "../components/TimeField";
import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";

export function ChoresScreen({ pinnedHeader = false }: { pinnedHeader?: boolean } = {}) {
  const {
    chores,
    members,
    completeChore,
    createChore,
    updateChore,
    deleteChore
  } = useHomeThreadStore();
  const isSavingChores = useHomeThreadStore(isHomeThreadSavingScope("chores"));
  const { scrollToTop } = useScrollAssist();
  const [showForm, setShowForm] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [pendingDeleteChoreId, setPendingDeleteChoreId] = useState<string | null>(null);
  const [expandedChoreId, setExpandedChoreId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [completionTone, setCompletionTone] = useState<"success" | "error" | "info">("success");
  const { celebration, scale: celebrationScale, opacity: celebrationOpacity, triggerCelebration } =
    useRewardCelebration();
  const [titleError, setTitleError] = useState<string | null>(null);
  const openChores = useMemo(() => chores.filter((chore) => !chore.completed), [chores]);
  const completedChores = useMemo(() => chores.filter((chore) => chore.completed), [chores]);
  const kidMembers = useMemo(() => members.filter((m) => m.role === "kid"), [members]);

  const nextDueChore = useMemo(
    () => openChores.find((chore) => chore.dueTime) ?? openChores[0] ?? null,
    [openChores]
  );

  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  const progressRatio = chores.length > 0 ? completedChores.length / chores.length : 0;
  const allDone = chores.length > 0 && openChores.length === 0;

  // Members who appear in at least one chore (open or completed)
  const tabMembers = useMemo(
    () => members.filter((m) => chores.some((c) => c.assignedTo === m.id)),
    [members, chores]
  );

  const filteredOpenChores = useMemo(
    () =>
      filterMemberId
        ? openChores.filter((c) => c.assignedTo === filterMemberId)
        : openChores,
    [openChores, filterMemberId]
  );

  const filteredCompletedChores = useMemo(
    () =>
      filterMemberId
        ? completedChores.filter((c) => c.assignedTo === filterMemberId)
        : completedChores,
    [completedChores, filterMemberId]
  );

  const filteredAllDone =
    filterMemberId
      ? filteredOpenChores.length === 0 && filteredCompletedChores.length > 0
      : allDone;

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
    resetForm();
    setShowForm(true);
  }

  function openEditForm(chore: (typeof chores)[number]) {
    setEditingChoreId(chore.id);
    setTitle(chore.title);
    setDueTime(choreDueTimeForField(chore.dueTime));
    setAssignedTo(chore.assignedTo === "unassigned" ? null : chore.assignedTo);
    setShowForm(true);
    setExpandedChoreId(null);
    setPendingDeleteChoreId(null);
    setTitleError(null);
    setErrorMessage(null);
  }

  function toggleForm() {
    if (showForm) {
      setShowForm(false);
      resetForm();
      return;
    }

    openCreateForm();
  }

  function closeForm() {
    if (isSavingChores) return;
    setShowForm(false);
    resetForm();
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
      setExpandedChoreId(null);
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
    const target = chores.find((chore) => chore.id === choreId);
    const assignedMember = target ? members.find((member) => member.id === target.assignedTo) : null;

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

    setExpandedChoreId(null);
    setCompletionTone(outcome.kind === "local" ? "info" : "success");
    setCompletionMessage(outcome.message);
    if (target && assignedMember?.role === "kid") {
      triggerCelebration(target.stars);
    }
  }

  return (
    <View style={styles.screen}>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>🧹</Text>
          </View>
          <Text style={styles.largeTitleText}>Chores</Text>
        </View>
      ) : null}
      {/* Header card */}
      <View style={styles.plannerCard}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            {pinnedHeader ? null : <Text style={styles.headerTitle}>Chores</Text>}
            <Text style={styles.headerMeta} numberOfLines={1}>
              {allDone
                ? `All ${completedChores.length} done · great work today`
                : openChores.length > 0 && completedChores.length > 0
                  ? `${completedChores.length} done · ${openChores.length} left to go`
                  : openChores.length > 0
                    ? `${openChores.length} waiting · let's knock them out`
                    : "Nothing assigned yet · tap Add to start"}
            </Text>
            {chores.length > 0 ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progressRatio * 100)}%` as `${number}%`,
                      backgroundColor: allDone ? colors.mint : colors.primary
                    }
                  ]}
                />
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add chore"
            onPress={openCreateForm}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add chore</Text>
          </Pressable>
        </View>

        {nextDueChore ? (
          <View style={styles.nextBar}>
            <View style={styles.nextAccent} />
            <View style={styles.nextIcon}>
              <Text style={styles.nextIconGlyph}>⭐</Text>
            </View>
            <View style={styles.nextCopy}>
              <Text style={styles.nextLabel}>Next up</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>
                {nextDueChore.title}
              </Text>
              {nextDueChore.dueLabel ? (
                <Text style={styles.nextSchedule} numberOfLines={1}>
                  {nextDueChore.dueLabel}
                </Text>
              ) : null}
            </View>
            {(() => {
              const member = members.find((m) => m.id === nextDueChore.assignedTo);
              return member ? <MemberAvatar member={member} size={28} /> : null;
            })()}
          </View>
        ) : null}
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      {/* Open chores */}
      <View style={styles.agendaArea}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Open chores</Text>
          <View style={styles.sectionHeaderRule} />
          {filteredOpenChores.length > 0 ? (
            <Text style={styles.sectionCount}>{filteredOpenChores.length}</Text>
          ) : null}
        </View>

        <ActionFeedback
          message={completionMessage ?? ""}
          tone={completionTone}
          visible={Boolean(completionMessage)}
        />
        <RewardCelebrationBanner celebration={celebration} scale={celebrationScale} opacity={celebrationOpacity} />

        {tabMembers.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsContent}
            style={styles.filterTabs}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show all chores"
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setFilterMemberId(null);
                setExpandedChoreId(null);
              }}
              style={[styles.filterTab, filterMemberId === null && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, filterMemberId === null && styles.filterTabTextActive]}>
                All
              </Text>
              <View style={[styles.filterTabBadge, filterMemberId === null && styles.filterTabBadgeActive]}>
                <Text style={[styles.filterTabBadgeText, filterMemberId === null && styles.filterTabBadgeTextActive]}>
                  {openChores.length}
                </Text>
              </View>
            </Pressable>
            {tabMembers.map((member) => {
              const isActive = filterMemberId === member.id;
              const memberOpen = openChores.filter((c) => c.assignedTo === member.id).length;
              return (
                <Pressable
                  key={member.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show chores for ${member.name}`}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setFilterMemberId(isActive ? null : member.id);
                    setExpandedChoreId(null);
                  }}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                >
                  <MemberAvatar member={member} size={18} />
                  <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]} numberOfLines={1}>
                    {member.name}
                  </Text>
                  {memberOpen > 0 ? (
                    <View style={[styles.filterTabBadge, isActive && styles.filterTabBadgeActive]}>
                      <Text style={[styles.filterTabBadgeText, isActive && styles.filterTabBadgeTextActive]}>
                        {memberOpen}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {filteredOpenChores.length > 0 ? (
          <View style={styles.choreList}>
            {filteredOpenChores.map((chore) => {
              const member = members.find((item) => item.id === chore.assignedTo);
              const isExpanded = expandedChoreId === chore.id;

              return (
                <View key={chore.id} style={[styles.choreRow, isExpanded && styles.choreRowExpanded]}>
                  <View style={styles.choreRowMain}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mark "${chore.title}" done`}
                      disabled={isSavingChores}
                      hitSlop={6}
                      onPress={() => void handleCompleteChore(chore.id)}
                      style={({ pressed }) => [styles.checkHit, pressed && styles.checkHitPressed]}
                    >
                      <View style={styles.checkCircle}>
                        <Ionicons name="ellipse-outline" size={22} color={colors.muted} />
                      </View>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                      accessibilityLabel={`${chore.title}. ${isExpanded ? "Hide" : "Show"} actions`}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedChoreId((current) => (current === chore.id ? null : chore.id));
                        setPendingDeleteChoreId(null);
                      }}
                      style={({ pressed }) => [styles.choreMain, pressed && styles.choreMainPressed]}
                    >
                      <View style={styles.choreCopy}>
                        <Text style={styles.choreTitle}>{chore.title}</Text>
                        {chore.dueLabel ? (
                          <Text style={styles.choreMeta}>{chore.dueLabel}</Text>
                        ) : null}
                      </View>
                      <View style={styles.choreTrailing}>
                        {member ? <MemberAvatar member={member} size={22} /> : null}
                        <Pill label={`${chore.stars}`} tone="gold" icon="star" />
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-forward"}
                          size={14}
                          color={colors.tertiary}
                        />
                      </View>
                    </Pressable>
                  </View>

                  {isExpanded ? (
                    <View style={styles.choreExpanded}>
                      {pendingDeleteChoreId === chore.id ? (
                        <View style={styles.deleteConfirm}>
                          <Text style={styles.deleteConfirmText}>Remove "{chore.title}"?</Text>
                          <View style={styles.deleteConfirmActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Keep chore"
                              onPress={() => setPendingDeleteChoreId(null)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Text style={styles.actionLinkText}>Keep</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Confirm remove "${chore.title}"`}
                              disabled={isSavingChores}
                              onPress={() => void handleDeleteChore(chore.id, chore.title)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Text style={[styles.actionLinkText, styles.deleteText]}>
                                {isSavingChores ? "Removing..." : "Remove"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.expandedActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit "${chore.title}"`}
                            disabled={isSavingChores}
                            onPress={() => openEditForm(chore)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                          >
                            <Text style={styles.actionLinkText}>Edit</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete "${chore.title}"`}
                            disabled={isSavingChores}
                            onPress={() => setPendingDeleteChoreId(chore.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                          >
                            <Text style={[styles.actionLinkText, styles.deleteText]}>Delete</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : filteredAllDone ? (
          <View style={styles.allDoneBlock}>
            <View style={styles.allDoneIcon}>
              <Ionicons name="checkmark-circle" size={32} color={colors.mint} />
            </View>
            <Text style={styles.allDoneTitle}>
              {filterMemberId
                ? `${members.find((m) => m.id === filterMemberId)?.name ?? "They"}'s all done!`
                : "All done for today!"}
            </Text>
            <Text style={styles.allDoneText}>
              {filteredCompletedChores.length === 1
                ? "1 chore knocked out. Nice work."
                : `${filteredCompletedChores.length} chores knocked out. Nice work.`}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No chores yet.</Text>
            <Text style={styles.emptyText}>
              Tap "Add chore" to create your first one — assign it to someone and set a daily time.
            </Text>
          </View>
        )}
      </View>

      {/* Completed section */}
      {filteredCompletedChores.length > 0 ? (
        <View style={styles.agendaArea}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Done today</Text>
            <View style={styles.sectionHeaderRule} />
            <Text style={styles.sectionCount}>{filteredCompletedChores.length}</Text>
          </View>
          <View style={styles.choreList}>
            {filteredCompletedChores.map((chore) => {
              const member = members.find((item) => item.id === chore.assignedTo);
              return (
                <View key={chore.id} style={styles.completedRow}>
                  <View style={styles.checkDone}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                  <View style={styles.choreCopy}>
                    <Text style={[styles.choreTitle, styles.doneTitleText]}>{chore.title}</Text>
                    {chore.dueLabel ? (
                      <Text style={styles.choreMeta}>{chore.dueLabel}</Text>
                    ) : null}
                  </View>
                  {member ? <MemberAvatar member={member} size={20} /> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Star balances — only shown when kids exist */}
      {kidMembers.length > 0 ? (
        <View style={styles.agendaArea}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Star balances</Text>
            <View style={styles.sectionHeaderRule} />
          </View>
          <View style={styles.rewardGrid}>
            {kidMembers.map((member) => (
              <View key={member.id} style={styles.rewardCard}>
                <MemberAvatar member={member} size={40} />
                <Text style={styles.rewardName} numberOfLines={1}>
                  {member.name}
                </Text>
                <View style={styles.rewardStarRow}>
                  <Ionicons name="star" size={14} color="#996A00" />
                  <Text style={styles.rewardStarCount}>{member.starBalance}</Text>
                </View>
                <Text style={styles.rewardMeta}>saved</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Footer note */}
      <View style={styles.footerNote}>
        <Ionicons name="repeat" size={13} color={colors.muted} />
        <Text style={styles.footerNoteText}>
          Chores repeat daily — completing one adds stars to that person's balance.
        </Text>
      </View>

      {/* Chore form modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeForm}
      >
        <SafeAreaView style={styles.composeSafe}>
          <KeyboardAvoidingView
            style={styles.composeRoot}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.composeStage}>
              <View style={styles.composePanel}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Ionicons name="star-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>
                      {editingChoreId ? "Edit chore" : "Add chore"}
                    </Text>
                    <Text style={styles.composeHint}>
                      {editingChoreId
                        ? "Update the details and save."
                        : "Give it a title and optionally assign it."}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingChores}
                    onPress={closeForm}
                    style={styles.composeCancelHit}
                  >
                    <Text style={styles.composeCancelText}>Cancel</Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.composeScroll}
                  contentContainerStyle={styles.composeScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>What needs doing?</Text>
                    <TextInput
                      accessibilityLabel="Chore title"
                      placeholder="Take out trash, walk the dog..."
                      placeholderTextColor={colors.muted}
                      value={title}
                      onChangeText={(value) => {
                        setTitle(value);
                        if (titleError) setTitleError(null);
                      }}
                      style={[styles.input, titleError ? styles.inputInvalid : null]}
                    />
                    <FieldError message={titleError} />
                  </View>

                  <View style={styles.formField}>
                    <TimeField
                      label="Daily due time · optional"
                      value={dueTime}
                      onChange={setDueTime}
                      placeholder="Tap to choose a time"
                    />
                    <Text style={styles.helperNote}>
                      Chores repeat daily. Add a time if you want a reminder nudge each day.
                    </Text>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Assign to · optional</Text>
                    <View style={styles.pickerRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear assignee"
                        onPress={() => setAssignedTo(null)}
                        style={[
                          styles.assignChip,
                          assignedTo === null ? styles.assignChipSelected : styles.assignChipIdle
                        ]}
                      >
                        <Text
                          style={[
                            styles.assignChipName,
                            assignedTo === null && styles.assignChipNameSelected
                          ]}
                        >
                          Unassigned
                        </Text>
                        {assignedTo === null ? (
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        ) : null}
                      </Pressable>
                      {members.map((member) => {
                        const selected = assignedTo === member.id;
                        return (
                          <Pressable
                            key={member.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${selected ? "Selected" : "Select"} ${member.name}`}
                            onPress={() => setAssignedTo(member.id)}
                            style={[
                              styles.assignChip,
                              selected ? styles.assignChipSelected : styles.assignChipIdle
                            ]}
                          >
                            <MemberAvatar member={member} size={22} />
                            <Text
                              style={[
                                styles.assignChipName,
                                selected && styles.assignChipNameSelected
                              ]}
                              numberOfLines={1}
                            >
                              {member.name}
                            </Text>
                            {selected ? (
                              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.composeFooter}>
                  <PrimaryButton
                    label={
                      isSavingChores ? "Saving..." : editingChoreId ? "Save changes" : "Add chore"
                    }
                    icon="checkmark"
                    loading={isSavingChores}
                    disabled={isSavingChores}
                    onPress={() => void handleSaveChore()}
                  />
                  <ActionFeedback
                    message={errorMessage ?? ""}
                    tone="error"
                    visible={Boolean(errorMessage)}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  screen: {
    gap: 0,
    paddingBottom: 96
  },
  // Large title (collapses into the pinned bar on scroll)
  largeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.md
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
  // Header card
  plannerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadow.card
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 10,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 26
  },
  headerMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 2
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    marginTop: 8,
    overflow: "hidden",
    width: "100%"
  },
  progressFill: {
    borderRadius: radii.pill,
    height: 4
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 3,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  // Next up bar
  nextBar: {
    alignItems: "flex-start",
    backgroundColor: colors.goldSoft,
    borderTopColor: "rgba(153,106,0,0.14)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  nextAccent: {
    backgroundColor: "#996A00",
    borderRadius: 2,
    marginTop: 2,
    minHeight: 36,
    width: 3
  },
  nextIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    height: 24,
    justifyContent: "center",
    marginTop: 1,
    width: 24
  },
  nextIconGlyph: {
    fontSize: 12,
    lineHeight: 15
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2
  },
  nextLabel: {
    color: "#996A00",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  nextTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 19,
    marginTop: 2
  },
  nextSchedule: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 3,
    opacity: 0.78
  },
  // Agenda layout
  agendaArea: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 2
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
    lineHeight: 18
  },
  sectionHeaderRule: {
    backgroundColor: colors.line,
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  choreList: {
    gap: 8
  },
  // Open chore row
  choreRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  choreRowExpanded: {
    borderColor: colors.lineStrong
  },
  choreRowMain: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 52
  },
  checkHit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 12
  },
  checkHitPressed: {
    opacity: 0.6
  },
  checkCircle: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28
  },
  choreMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingRight: 14,
    paddingVertical: 11
  },
  choreMainPressed: {
    backgroundColor: "rgba(247,243,238,0.72)"
  },
  choreCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  choreTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 19
  },
  choreMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 15
  },
  choreTrailing: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end"
  },
  // Expanded actions
  choreExpanded: {
    backgroundColor: colors.canvas,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 8
  },
  expandedActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  actionLink: {
    justifyContent: "center",
    minHeight: 28,
    paddingVertical: 2
  },
  actionLinkPressed: {
    opacity: 0.65
  },
  actionLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  deleteText: {
    color: colors.coral
  },
  // Delete confirm
  deleteConfirm: {
    gap: spacing.xs
  },
  deleteConfirmText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  deleteConfirmActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  // Completed rows
  completedRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    opacity: 0.72,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  checkDone: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 14,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  doneTitleText: {
    color: colors.muted,
    textDecorationLine: "line-through"
  },
  // Star reward grid
  rewardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  rewardCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.goldSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  rewardName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center"
  },
  rewardStarRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  rewardStarCount: {
    color: "#996A00",
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  rewardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  // Filter tabs
  filterTabs: {
    marginBottom: 2
  },
  filterTabsContent: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  filterTab: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterTabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  filterTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  filterTabTextActive: {
    color: colors.primary
  },
  filterTabBadge: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4
  },
  filterTabBadgeActive: {
    backgroundColor: colors.primary
  },
  filterTabBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  filterTabBadgeTextActive: {
    color: "#FFFFFF"
  },
  // All done state
  allDoneBlock: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  allDoneIcon: {
    marginBottom: 4
  },
  allDoneTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  },
  allDoneText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "center"
  },
  // Empty state
  emptyBlock: {
    paddingHorizontal: 2,
    paddingVertical: 12
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 4
  },
  // Footer note
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
  // Form modal
  composeSafe: {
    backgroundColor: "#EDE4D6",
    flex: 1
  },
  composeRoot: {
    flex: 1
  },
  composeStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  composePanel: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    maxWidth: 440,
    overflow: "hidden",
    width: "100%",
    ...shadow.card
  },
  composeHeader: {
    alignItems: "flex-start",
    backgroundColor: colors.goldSoft,
    borderBottomColor: "rgba(153,106,0,0.14)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 14,
    paddingHorizontal: spacing.md,
    paddingTop: 14
  },
  composeHeaderMark: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(153,106,0,0.18)",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    marginTop: 2,
    width: 36
  },
  composeHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs
  },
  composeTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 26
  },
  composeHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 3
  },
  composeCancelHit: {
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 2,
    paddingVertical: 4
  },
  composeCancelText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  composeScroll: {
    backgroundColor: colors.surface,
    flex: 1
  },
  composeScrollContent: {
    gap: 12,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  composeFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? spacing.md : spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  // Form fields
  formField: {
    gap: 6
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inputInvalid: {
    borderColor: colors.coral
  },
  helperNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  assignChip: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    maxWidth: "100%",
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  assignChipIdle: {
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong
  },
  assignChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  assignChipName: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 110
  },
  assignChipNameSelected: {
    color: colors.primary
  }
});
