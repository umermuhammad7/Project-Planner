import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { DateField } from "../components/DateField";
import { Card, FieldError, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { TimeField } from "../components/TimeField";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { TravelReminderStatus } from "../types";
import { compareEventsByStartAt, describeImportedEventSource, getEventUrgency } from "../utils/eventUrgency";
import { CalendarSyncScreen } from "./CalendarSyncScreen";

export function PlanScreen() {
  const { events, members, createEvent, updateEvent, deleteEvent, refreshFromBackend, isSaving, isHydrating, saveMessage, syncSource, syncMessage, realtimeStatus, realtimeMessage } =
    useHomeThreadStore();
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
  const [travelMessage, setTravelMessage] = useState<string>("Travel reminders need an upcoming event with map coordinates.");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const formOpacity = useRef(new Animated.Value(0)).current;

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);
  const sortedEvents = useMemo(() => [...events].sort(compareEventsByStartAt), [events]);
  const travelCandidate = useMemo(
    () => sortedEvents.find((event) => event.startAt && event.location),
    [sortedEvents]
  );
  const nextEvent = useMemo(
    () => sortedEvents.find((event) => getEventUrgency(event)?.label !== "Past") ?? null,
    [sortedEvents]
  );
  const upcomingCount = useMemo(
    () => sortedEvents.filter((event) => getEventUrgency(event)?.label !== "Past").length,
    [sortedEvents]
  );

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!showForm) {
      formOpacity.setValue(0);
      return;
    }

    Animated.timing(formOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== "web"
    }).start();
  }, [formOpacity, showForm]);

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

  function resetForm() {
    setTitle("");
    setLocation("");
    setStartDate(formatDateInput(new Date()));
    setStartTime("");
    setMemberIds([]);
    setEditingEventId(null);
    setTitleError(null);
  }

  function populateForm(event: (typeof sortedEvents)[number]) {
    setTitle(event.title);
    setLocation(event.location ?? "");
    const sourceDate = event.startAt ? new Date(event.startAt) : new Date();
    setStartDate(formatDateInput(sourceDate));
    setStartTime(formatTimeInput(sourceDate));
    setMemberIds(event.assignedTo);
    setEditingEventId(event.id);
    setErrorMessage(null);
    setTitleError(null);
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
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setTitleError(null);

    if (!title.trim()) {
      setTitleError("Event title is required.");
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

    setErrorMessage(outcome.message || "Could not create that event.");
  }

  async function handleDeleteEvent(eventId: string, titleText: string) {
    if (isSaving) {
      return;
    }

    Alert.alert("Delete event?", `Remove "${titleText}" from the household plan?`, [
      { text: "Cancel", style: "cancel" },
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
        setTravelMessage("Travel reminders need a signed-in household.");
        return;
      }

      const familyId = useHomeThreadStore.getState().familyId;
      if (!familyId || !travelCandidate) {
        setTravelStatus(null);
        setTravelMessage("Travel reminders need an upcoming event with map coordinates.");
        return;
      }

      const result = await apiRequest<TravelReminderStatus>(
        `/families/${familyId}/events/${travelCandidate.id}/travel-reminder`
      );
      if (!result.data) {
        setTravelStatus(null);
        setTravelMessage(result.error?.message ?? "Could not load travel reminder status.");
        return;
      }

      setTravelStatus(result.data);
      setTravelMessage(result.data.reason);
    }

    void loadTravelStatus();
  }, [syncSource, travelCandidate?.id]);

  if (showCalendarSync) {
    return <CalendarSyncScreen onBack={() => setShowCalendarSync(false)} />;
  }

  return (
    <View>
      <ScreenHeader
        eyebrow="Plan"
        title="This week"
        subtitle="Add and edit plans for the household."
        icon="calendar-clear"
        badgeLabel={`${upcomingCount} upcoming`}
        badgeTone={upcomingCount > 0 ? "mint" : "neutral"}
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
          label={showForm ? "Close event form" : "Add event"}
          icon={showForm ? "close" : "add"}
          tone={showForm ? "soft" : "primary"}
          onPress={toggleForm}
        />
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      {!showForm ? (
        <>
          <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
          <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />
        </>
      ) : null}

      {showForm ? (
        <Animated.View style={{ opacity: formOpacity }}>
          <Card>
            <Text style={styles.formTitle}>{editingEventId ? "Edit event" : "Create event"}</Text>
            <Text style={styles.formHint}>Pick the day, add a time if needed, then save.</Text>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              accessibilityLabel="Event title"
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
            <TextInput
              accessibilityLabel="Event location"
              placeholder="Location (optional)"
              placeholderTextColor={colors.muted}
              value={location}
              onChangeText={setLocation}
              style={styles.input}
            />
            <DateField label="Day" value={startDate} onChange={setStartDate} />
            <TimeField label="Start time (optional)" value={startTime} onChange={setStartTime} placeholder="Choose a time" />
            <Text style={styles.pickerLabel}>Assign to</Text>
            <View style={styles.pickerRow}>
              {members.map((member) => {
                const selected = memberIds.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? "Remove" : "Add"} ${member.name} to event`}
                    onPress={() => toggleMember(member.id)}
                  >
                    <Pill label={member.name} tone={selected ? "primary" : "neutral"} />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.formActions}>
              <PrimaryButton
                label={isSaving ? (editingEventId ? "Saving..." : "Creating...") : editingEventId ? "Save changes" : "Create event"}
                icon="checkmark"
                loading={isSaving}
                disabled={isSaving || !canSubmit}
                onPress={() => {
                  void handleCreateEvent();
                }}
              />
              {editingEventId ? (
                <PrimaryButton
                  label="Cancel edit"
                  icon="close"
                  tone="ghost"
                  disabled={isSaving}
                  onPress={() => {
                    if (isSaving) return;
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setShowForm(false);
                    resetForm();
                  }}
                />
              ) : null}
            </View>
            <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />
            <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
          </Card>
        </Animated.View>
      ) : null}

      <View style={styles.utilityRow}>
        <PrimaryButton
          label={isHydrating ? "Refreshing..." : "Refresh"}
          icon="sync"
          tone="ghost"
          loading={isHydrating}
          disabled={isHydrating}
          onPress={() => void refreshFromBackend()}
        />
        <PrimaryButton label="Google Calendar" icon="calendar" tone="ghost" onPress={() => setShowCalendarSync(true)} />
      </View>

      <Card>
        <View style={styles.snapshotRow}>
          <View style={styles.snapshotBlock}>
            <Text style={styles.snapshotLabel}>Next up</Text>
            <Text style={styles.snapshotValue}>{nextEvent ? nextEvent.title : "The week is still open"}</Text>
            <Text style={styles.snapshotMeta}>
              {nextEvent
                ? `${nextEvent.time}${nextEvent.location ? ` - ${nextEvent.location}` : ""}`
                : "Add the first anchor point for the week."}
            </Text>
          </View>
          <View style={styles.snapshotStats}>
            <Text style={styles.snapshotNumber}>{upcomingCount}</Text>
            <Text style={styles.snapshotStatLabel}>upcoming plans</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.foundationTitle}>Smart travel reminders</Text>
        <Text style={styles.foundationText}>
          {travelStatus?.supported
            ? `Travel reminders are configured. Suggested lead time is ${travelStatus.recommendedLeadMinutes} minutes for ${travelCandidate?.title ?? "the next event"}.`
            : travelMessage}
        </Text>
        {travelStatus?.estimatedTravelMinutes ? (
          <Text style={styles.foundationMeta}>
            Estimated drive time: {travelStatus.estimatedTravelMinutes} minutes via {travelStatus.provider === "google_maps" ? "Google Maps" : "unavailable"}.
          </Text>
        ) : null}
      </Card>

      <SectionTitle title="Household" />
      <View style={styles.peopleRow}>
        {members.map((member) => (
          <Card key={member.id}>
            <View style={styles.personCard}>
              <View style={[styles.avatarDot, { backgroundColor: member.color }]}>
                <Text style={styles.avatarText}>{member.initials}</Text>
              </View>
              <Text style={styles.personName}>{member.name}</Text>
              <Pill label={member.role} tone="neutral" />
            </View>
          </Card>
        ))}
      </View>

      <SectionTitle title="Plans ahead" action={`${upcomingCount} upcoming`} />
      <View style={styles.stack}>
        {sortedEvents.length > 0 ? (
          sortedEvents.map((event) => {
            const assigned = event.assignedTo
              .map((id) => members.find((member) => member.id === id)?.name)
              .filter(Boolean)
              .join(", ");
            const urgency = getEventUrgency(event);
            const importedSource = describeImportedEventSource(event);
            const eventColor =
              members.find((member) => member.id === event.assignedTo[0])?.color ?? colors.primary;
            const isExpanded = expandedEventId === event.id;
            const scheduleLabel = event.dateLabel ? `${event.dateLabel} at ${event.time}` : event.time;

            return (
              <Card key={event.id}>
                <Row align="flex-start">
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: eventColor }]} />
                    <View style={[styles.line, { backgroundColor: `${eventColor}33` }]} />
                  </View>
                  <View style={styles.fill}>
                    <Row>
                      <Text style={styles.time}>{event.time}</Text>
                      {urgency ? <Pill label={urgency.label} tone={urgency.tone} /> : null}
                      {event.countdownLabel ? <Pill label={event.countdownLabel} tone="gold" /> : null}
                      {importedSource ? <Pill label={importedSource} tone="mint" /> : null}
                      {!importedSource ? (
                        <Pill label={event.source} tone={event.source === "assistant" ? "mint" : "primary"} />
                      ) : null}
                    </Row>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.schedule}>{scheduleLabel}</Text>
                    {assigned ? <Text style={styles.meta}>{assigned}</Text> : null}
                    {event.location ? <Text style={styles.location}>{event.location}</Text> : null}
                    <View style={styles.eventActionRow}>
                      <PrimaryButton
                        label="Edit"
                        icon="create"
                        disabled={isSaving}
                        onPress={() => populateForm(event)}
                      />
                      <PrimaryButton
                        label="Delete"
                        icon="trash"
                        tone="ghost"
                        disabled={isSaving}
                        onPress={() => {
                          void handleDeleteEvent(event.id, event.title);
                        }}
                      />
                      <PrimaryButton
                        label={isExpanded ? "Hide details" : "Details"}
                        icon={isExpanded ? "chevron-up" : "chevron-down"}
                        tone="ghost"
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedEventId((current) => (current === event.id ? null : event.id));
                        }}
                      />
                    </View>
                    {isExpanded ? (
                      <View style={styles.expandedMeta}>
                        <Text style={styles.expandedMetaText}>
                          {assigned ? `Assigned to ${assigned}. ` : ""}
                          {event.location ? `Location: ${event.location}. ` : ""}
                          Source: {importedSource ?? event.source}.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Row>
              </Card>
            );
          })
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>Nothing is on the family calendar yet.</Text>
            <Text style={styles.emptyText}>
              Add the first event or import a calendar so this becomes the place everyone checks each morning.
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
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.sm
  },
  foundationTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  foundationText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.sm
  },
  foundationMeta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.sm
  },
  snapshotRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  snapshotBlock: {
    flex: 1,
    gap: spacing.xs
  },
  snapshotLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 23,
    fontWeight: "700",
    lineHeight: 29
  },
  snapshotMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  snapshotStats: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  snapshotNumber: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "700"
  },
  snapshotStatLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: spacing.xs,
    textAlign: "center",
    textTransform: "uppercase"
  },
  formTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  formHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: spacing.md
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm
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
  formActions: {
    gap: spacing.md,
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
  peopleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  personCard: {
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 112
  },
  avatarDot: {
    alignItems: "center",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  personName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  stack: {
    gap: spacing.md
  },
  rail: {
    alignItems: "center",
    width: 18
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: 7,
    height: 14,
    width: 14
  },
  line: {
    backgroundColor: colors.line,
    flex: 1,
    marginTop: 4,
    minHeight: 58,
    width: 2
  },
  fill: {
    flex: 1,
    gap: spacing.sm
  },
  time: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  eventTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  schedule: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  location: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  eventActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  expandedMeta: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.sm
  },
  expandedMetaText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
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
