import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  useWindowDimensions,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { DateField } from "../components/DateField";
import { FieldError, MemberAvatar, PrimaryButton } from "../components/Primitives";
import { TimeField } from "../components/TimeField";
import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { apiRequest } from "../services/api";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";
import { TravelReminderStatus } from "../types";
import { compareEventsByStartAt, describeImportedEventSource, getEventUrgency } from "../utils/eventUrgency";
import { safeText } from "../utils/safeRender";
import { CalendarSyncScreen } from "./CalendarSyncScreen";
import type { PlanEvent } from "../types";

function calendarDayDiff(value: Date, now: Date) {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((start - today) / 86400000);
}

function agendaDividerLabel(event: Pick<PlanEvent, "startAt">, now = new Date()) {
  if (!event.startAt) {
    return "Later";
  }

  const startsAt = new Date(event.startAt);
  if (Number.isNaN(startsAt.getTime())) {
    return "Later";
  }

  const dayDiff = calendarDayDiff(startsAt, now);
  if (dayDiff === 0) {
    return "Today";
  }
  if (dayDiff === 1) {
    return "Tomorrow";
  }
  if (dayDiff < 0) {
    return "Earlier";
  }

  return startsAt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatNextSchedule(event: Pick<PlanEvent, "startAt" | "time" | "dateLabel">) {
  if (event.startAt) {
    const startsAt = new Date(event.startAt);
    if (!Number.isNaN(startsAt.getTime())) {
      const datePart = startsAt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
      const timeText = typeof event.time === "string" ? event.time.trim() : "";
      if (timeText && timeText.toLowerCase() !== "anytime") {
        return `${datePart} - ${timeText}`;
      }
      return datePart;
    }
  }

  return [event.dateLabel, event.time].filter(Boolean).join(" - ") || "Soon";
}

export function PlanScreen() {
  const { events, members, createEvent, updateEvent, deleteEvent, syncSource } = useHomeThreadStore();
  const isSavingPlan = useHomeThreadStore(isHomeThreadSavingScope("plan"));
  const { width: windowWidth } = useWindowDimensions();
  const composePanelMaxWidth = Math.min(windowWidth - spacing.md * 2, 440);
  const { scrollToOffset, scrollToTop } = useScrollAssist();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [startTime, setStartTime] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [travelStatus, setTravelStatus] = useState<TravelReminderStatus | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showEarlierPlans, setShowEarlierPlans] = useState(false);
  const [planQuery, setPlanQuery] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [startTimeError, setStartTimeError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);
  const sortedEvents = useMemo(() => [...events].sort(compareEventsByStartAt), [events]);
  const travelCandidate = useMemo(
    () => sortedEvents.find((event) => event.startAt && event.location),
    [sortedEvents]
  );
  const upcomingCount = useMemo(
    () => sortedEvents.filter((event) => getEventUrgency(event)?.label !== "Past").length,
    [sortedEvents]
  );
  const nextEvent = useMemo(
    () => sortedEvents.find((event) => getEventUrgency(event)?.label !== "Past") ?? null,
    [sortedEvents]
  );
  const showPlanSearch = sortedEvents.length > 8;
  const filteredEvents = useMemo(() => {
    const query = planQuery.trim().toLowerCase();
    if (!showPlanSearch || !query) {
      return sortedEvents;
    }

    return sortedEvents.filter((event) => {
      const titleText = safeText(event.title, "").toLowerCase();
      const locationText = (event.location ?? "").toLowerCase();
      return titleText.includes(query) || locationText.includes(query);
    });
  }, [planQuery, showPlanSearch, sortedEvents]);
  const agendaGroups = useMemo(() => {
    const groups: Array<{ label: string; events: typeof sortedEvents }> = [];

    for (const event of filteredEvents) {
      const label = agendaDividerLabel(event);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) {
        groups.push({ label, events: [event] });
      } else {
        last.events.push(event);
      }
    }

    const upcoming = groups.filter((group) => group.label !== "Earlier");
    const earlier = groups.filter((group) => group.label === "Earlier");
    return [...upcoming, ...earlier];
  }, [filteredEvents]);
  const searchingPlans = showPlanSearch && planQuery.trim().length > 0;

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!successMessage && !infoMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setInfoMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage, infoMessage]);

  const toggleMember = (id: string) => {
    setMemberIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  function closeForm() {
    if (isSavingPlan) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowForm(false);
    resetForm();
  }

  function resetForm() {
    setTitle("");
    setLocation("");
    setStartDate(formatDateInput(new Date()));
    setStartTime("");
    setMemberIds([]);
    setEditingEventId(null);
    setTitleError(null);
    setStartDateError(null);
    setStartTimeError(null);
  }

  function populateForm(event: (typeof sortedEvents)[number]) {
    setTitle(event.title);
    setLocation(event.location ?? "");
    const sourceDate = event.startAt ? new Date(event.startAt) : new Date();
    setStartDate(formatDateInput(sourceDate));
    setStartTime(formatTimeInput(sourceDate));
    setMemberIds(Array.isArray(event.assignedTo) ? event.assignedTo : []);
    setEditingEventId(event.id);
    setErrorMessage(null);
    setTitleError(null);
    setStartDateError(null);
    setStartTimeError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowForm(true);
    setTimeout(() => scrollToOffset(120), 80);
  }

  function toggleForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !showForm;
    setShowForm(next);
    setErrorMessage(null);
    setTitleError(null);
    if (!next) {
      resetForm();
    }

    if (next) {
      setTimeout(() => scrollToOffset(120), 80);
    }
  }

  async function handleCreateEvent() {
    if (isSavingPlan) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setTitleError(null);
    setStartDateError(null);
    setStartTimeError(null);

    if (!title.trim()) {
      setTitleError("Plan title is required.");
      return;
    }

    const outcome = editingEventId
      ? await updateEvent({ eventId: editingEventId, title, location, startDate, startTime, memberIds })
      : await createEvent({ title, location, startDate, startTime, memberIds });
    if (outcome.kind === "saved") {
      const savedTitle = title.trim();
      const wasEditing = Boolean(editingEventId);
      resetForm();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowForm(false);
      scrollToTop();
      setSuccessMessage(
        wasEditing ? `"${savedTitle}" was updated.` : `"${savedTitle}" is now on the family plan.`
      );
      return;
    }

    if (outcome.kind === "queued") {
      setInfoMessage(outcome.message);
      return;
    }

    if (outcome.invalidField === "date") {
      setStartDateError(outcome.message);
      return;
    }

    if (outcome.invalidField === "time") {
      setStartTimeError(outcome.message);
      return;
    }

    setErrorMessage(outcome.message || "Could not create that event.");
  }

  async function handleDeleteEvent(eventId: string, titleText: string) {
    if (isSavingPlan) {
      return;
    }

    Alert.alert(`Delete "${titleText}"?`, "This removes it from the household plan.", [
      { text: "Keep plan", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteEvent(eventId).then((outcome) => {
            if (!outcome.ok) {
              setErrorMessage(outcome.message);
              return;
            }

            setExpandedEventId((current) => (current === eventId ? null : current));
            if (editingEventId === eventId) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowForm(false);
              resetForm();
            }
            scrollToTop();
            setSuccessMessage(`"${titleText}" was removed.`);
          });
        }
      }
    ]);
  }

  useEffect(() => {
    async function loadTravelStatus() {
      if (syncSource !== "api") {
        setTravelStatus(null);
        return;
      }

      const familyId = useHomeThreadStore.getState().familyId;
      if (!familyId || !travelCandidate) {
        setTravelStatus(null);
        return;
      }

      const result = await apiRequest<TravelReminderStatus>(
        `/families/${familyId}/events/${travelCandidate.id}/travel-reminder`
      );
      if (!result.data) {
        setTravelStatus(null);
        return;
      }

      setTravelStatus(result.data);
    }

    void loadTravelStatus();
  }, [syncSource, travelCandidate?.id]);

  if (showCalendarSync) {
    return <CalendarSyncScreen onBack={() => setShowCalendarSync(false)} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.plannerCard}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>This week</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {upcomingCount > 0
                ? `${upcomingCount} plan${upcomingCount === 1 ? "" : "s"} coming up`
                : "Nothing planned yet"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add plan"
            onPress={toggleForm}
            style={({ pressed }) => [styles.addPlanButton, pressed && styles.addPlanButtonPressed]}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.addPlanButtonText}>Add plan</Text>
          </Pressable>
        </View>
        <View style={styles.nextBar}>
          <View style={styles.nextAccent} />
          <View style={styles.nextIcon}>
            <Text style={styles.nextIconGlyph}>⏰</Text>
          </View>
          <View style={styles.nextCopy}>
            <Text style={styles.nextLabel}>Next</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>
              {nextEvent ? safeText(nextEvent.title, "Untitled plan") : "Add a plan to get started"}
            </Text>
            {nextEvent ? (
              <Text style={styles.nextSchedule} numberOfLines={1}>
                {formatNextSchedule(nextEvent)}
              </Text>
            ) : null}
            {nextEvent?.location ? (
              <Text style={styles.nextLocation} numberOfLines={1}>
                {nextEvent.location}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      <View style={styles.agendaArea}>
        {showPlanSearch ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              accessibilityLabel="Search plans"
              placeholder="Search by title or place"
              placeholderTextColor={colors.muted}
              value={planQuery}
              onChangeText={(value) => {
                setPlanQuery(value);
                setExpandedEventId(null);
              }}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}

        {sortedEvents.length > 0 ? (
          agendaGroups.length > 0 ? (
            agendaGroups.map((group) => {
              const isEarlierGroup = group.label === "Earlier";
              const earlierCollapsible = isEarlierGroup && group.events.length > 1;
              const earlierCollapsed = earlierCollapsible && !showEarlierPlans && !searchingPlans;

              return (
                <View key={group.label} style={styles.dateGroup}>
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateHeading}>{group.label}</Text>
                    <View style={styles.dateHeaderRule} />
                  </View>
                  {earlierCollapsed ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Show earlier plans, ${group.events.length}`}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setShowEarlierPlans(true);
                      }}
                      style={({ pressed }) => [styles.earlierToggle, pressed && styles.earlierTogglePressed]}
                    >
                      <Text style={styles.earlierToggleText}>
                        Show earlier plans ({group.events.length})
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.dateGroupRows}>
                      {group.events.map((event) => {
                        const assignedTo = Array.isArray(event.assignedTo) ? event.assignedTo : [];
                        const assignedMembers = assignedTo
                          .map((id) => members.find((member) => member.id === id))
                          .filter((member): member is (typeof members)[number] => Boolean(member));
                        const assignedNames = assignedMembers.map((member) => member.name).join(", ");
                        const importedSource = describeImportedEventSource(event);
                        const isExpanded = expandedEventId === event.id;
                        const eventTitle = safeText(event.title, "Untitled plan");
                        const eventTime = safeText(event.time, "Anytime");
                        const metaLine = [eventTime, event.location, assignedNames].filter(Boolean).join(" - ");
                        const firstAssignee = assignedMembers[0] ?? null;

                        return (
                          <View
                            key={event.id}
                            style={[styles.eventRow, isExpanded ? styles.eventRowExpanded : null]}
                          >
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ expanded: isExpanded }}
                              accessibilityLabel={`${eventTitle}. ${metaLine}. ${isExpanded ? "Hide" : "Show"} details`}
                              onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setExpandedEventId((current) => (current === event.id ? null : event.id));
                              }}
                              style={({ pressed }) => [styles.eventMainHit, pressed && styles.eventRowPressed]}
                            >
                              <View style={styles.eventBody}>
                                <Text style={styles.eventTitle} numberOfLines={2}>
                                  {eventTitle}
                                </Text>
                                <Text style={styles.eventMeta} numberOfLines={1}>
                                  {metaLine}
                                </Text>
                              </View>
                              <View style={styles.eventTrailing}>
                                {firstAssignee ? <MemberAvatar member={firstAssignee} size={18} /> : null}
                                <Ionicons
                                  name={isExpanded ? "chevron-up" : "chevron-forward"}
                                  size={14}
                                  color={colors.tertiary}
                                />
                              </View>
                            </Pressable>

                            {isExpanded ? (
                              <View style={styles.expandedBlock}>
                                {importedSource ? (
                                  <Text style={styles.expandedText}>From {importedSource}</Text>
                                ) : null}
                                <View style={styles.expandedActions}>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit ${eventTitle}`}
                                    disabled={isSavingPlan}
                                    onPress={() => populateForm(event)}
                                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                    style={({ pressed }) => [
                                      styles.expandedActionHit,
                                      pressed && styles.expandedActionHitPressed
                                    ]}
                                  >
                                    <Text style={styles.expandedActionText}>Edit</Text>
                                  </Pressable>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Delete ${eventTitle}`}
                                    disabled={isSavingPlan}
                                    onPress={() => {
                                      void handleDeleteEvent(event.id, eventTitle);
                                    }}
                                    style={({ pressed }) => [
                                      styles.deleteHit,
                                      pressed && styles.expandedActionHitPressed
                                    ]}
                                  >
                                    <Text style={styles.deleteText}>Delete</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                      {earlierCollapsible && showEarlierPlans ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Hide earlier plans"
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowEarlierPlans(false);
                            setExpandedEventId(null);
                          }}
                          style={({ pressed }) => [styles.earlierToggle, pressed && styles.earlierTogglePressed]}
                        >
                          <Text style={styles.earlierToggleText}>Hide earlier plans</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>No matching plans</Text>
              <Text style={styles.emptyText}>Try a different title or place.</Text>
            </View>
          )
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No plans yet</Text>
            <Text style={styles.emptyText}>Add one so the week has a clear starting point.</Text>
          </View>
        )}
      </View>

      {travelStatus?.supported ? (
        <Text style={styles.leaveTip}>
          Leave about {travelStatus.recommendedLeadMinutes} min early for{" "}
          {travelCandidate?.title ?? "the next plan"}
          {travelStatus.estimatedTravelMinutes
            ? ` - ~${travelStatus.estimatedTravelMinutes} min travel`
            : ""}
          .
        </Text>
      ) : null}

      <View style={styles.calendarSection}>
        <View style={styles.calendarCopy}>
          <Text style={styles.calendarLabel}>Calendar</Text>
          <Text style={styles.calendarStatus}>
            Connect a calendar to bring outside events into your family plan
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connect calendars"
          onPress={() => setShowCalendarSync(true)}
          style={({ pressed }) => [styles.calendarAction, pressed && styles.calendarActionPressed]}
        >
          <Text style={styles.calendarActionText}>Connect</Text>
        </Pressable>
      </View>

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
              <View style={[styles.composePanel, { maxWidth: composePanelMaxWidth }]}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>{editingEventId ? "Edit plan" : "Add plan"}</Text>
                    <Text style={styles.composeHint}>Add the essentials, then save.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingPlan}
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
                    <Text style={styles.fieldLabel}>What is it?</Text>
                    <TextInput
                      accessibilityLabel="Plan title"
                      placeholder="Soccer practice, dinner out..."
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
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Where? · optional</Text>
                    <TextInput
                      accessibilityLabel="Plan location"
                      placeholder="Home, school, park..."
                      placeholderTextColor={colors.muted}
                      value={location}
                      onChangeText={setLocation}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.scheduleRow}>
                    <View style={styles.scheduleCol}>
                      <DateField
                        label="Date"
                        value={startDate}
                        onChange={(value) => {
                          setStartDate(value);
                          if (startDateError) {
                            setStartDateError(null);
                          }
                        }}
                      />
                      <FieldError message={startDateError} />
                    </View>
                    <View style={styles.scheduleCol}>
                      <TimeField
                        label="Time · optional"
                        value={startTime}
                        onChange={(value) => {
                          setStartTime(value);
                          if (startTimeError) {
                            setStartTimeError(null);
                          }
                        }}
                        placeholder="Anytime"
                      />
                      <FieldError message={startTimeError} />
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Who is involved?</Text>
                    <View style={styles.pickerRow}>
                      {members.map((member) => {
                        const selected = memberIds.includes(member.id);
                        return (
                          <Pressable
                            key={member.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${selected ? "Remove" : "Add"} ${member.name} to plan`}
                            onPress={() => toggleMember(member.id)}
                            style={[styles.assignChip, selected ? styles.assignChipSelected : styles.assignChipIdle]}
                          >
                            <MemberAvatar member={member} size={22} />
                            <Text
                              style={[styles.assignChipName, selected && styles.assignChipNameSelected]}
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
                      isSavingPlan
                        ? "Saving..."
                        : editingEventId
                          ? "Save changes"
                          : "Add plan"
                    }
                    icon="checkmark"
                    loading={isSavingPlan}
                    disabled={isSavingPlan || !canSubmit}
                    onPress={() => {
                      void handleCreateEvent();
                    }}
                  />
                  <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />
                  <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    paddingBottom: 96
  },
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
  nextBar: {
    alignItems: "flex-start",
    backgroundColor: colors.mintSoft,
    borderTopColor: "rgba(92,122,90,0.14)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  nextAccent: {
    backgroundColor: colors.mint,
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
    color: colors.mint,
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
  nextLocation: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 2
  },
  addPlanButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 3,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addPlanButtonPressed: {
    backgroundColor: colors.primaryPressed
  },
  addPlanButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
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
    overflow: "hidden",
    width: "100%",
    ...shadow.card
  },
  composeHeader: {
    alignItems: "flex-start",
    backgroundColor: colors.primarySoft,
    borderBottomColor: "rgba(139,107,74,0.14)",
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
    borderColor: "rgba(139,107,74,0.18)",
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
  formField: {
    gap: 6
  },
  scheduleRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  scheduleCol: {
    flex: 1,
    minWidth: 0
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
  },
  agendaArea: {
    gap: spacing.lg,
    marginBottom: spacing.lg
  },
  searchWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    minHeight: 28,
    paddingVertical: 0
  },
  dateGroup: {
    gap: 10
  },
  dateHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 2
  },
  dateHeading: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
    lineHeight: 18
  },
  dateHeaderRule: {
    backgroundColor: colors.line,
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  dateGroupRows: {
    gap: 8
  },
  earlierToggle: {
    alignSelf: "flex-start",
    paddingHorizontal: 2,
    paddingVertical: 6
  },
  earlierTogglePressed: {
    opacity: 0.65
  },
  earlierToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600"
  },
  eventRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  eventRowExpanded: {
    borderColor: colors.lineStrong
  },
  eventMainHit: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  eventRowPressed: {
    backgroundColor: "rgba(247,243,238,0.72)"
  },
  eventBody: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  eventTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 19
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 15
  },
  eventTrailing: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end"
  },
  expandedBlock: {
    backgroundColor: colors.canvas,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 8
  },
  expandedText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14
  },
  expandedActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  expandedActionHit: {
    justifyContent: "center",
    minHeight: 28,
    paddingVertical: 2
  },
  expandedActionHitPressed: {
    opacity: 0.65
  },
  expandedActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  deleteHit: {
    justifyContent: "center",
    minHeight: 28,
    paddingVertical: 2
  },
  deleteText: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: "700"
  },
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
  leaveTip: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginBottom: spacing.md,
    paddingHorizontal: 2
  },
  calendarSection: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.md
  },
  calendarCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  calendarLabel: {
    color: colors.tertiary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  calendarStatus: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17
  },
  calendarAction: {
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  calendarActionPressed: {
    opacity: 0.7
  },
  calendarActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeInput(value: Date) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
