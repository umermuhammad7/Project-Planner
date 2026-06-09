import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { TravelReminderStatus } from "../types";
import { compareEventsByStartAt, describeImportedEventSource, getEventUrgency } from "../utils/eventUrgency";
import { CalendarSyncScreen } from "./CalendarSyncScreen";

export function PlanScreen() {
  const { events, members, createEvent, refreshFromBackend, isSaving, isHydrating, saveMessage, syncSource, realtimeStatus, realtimeMessage } =
    useHomeThreadStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [travelStatus, setTravelStatus] = useState<TravelReminderStatus | null>(null);
  const [travelMessage, setTravelMessage] = useState<string>("Travel reminders need an upcoming event with map coordinates.");

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
  const toggleMember = (id: string) => {
    setMemberIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  useEffect(() => {
    async function loadTravelStatus() {
      if (syncSource !== "api") {
        setTravelStatus(null);
        setTravelMessage("Travel reminders need the local API connected.");
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
      <Text style={styles.title}>This week</Text>
      <Text style={styles.subtitle}>A shared family plan that still holds together when details travel by text.</Text>

      <SyncStatusRow
        syncSource={syncSource}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
        showLiveNote
      />

      <View style={styles.actionRow}>
        <PrimaryButton label={isHydrating ? "Refreshing..." : "Refresh"} icon="sync" tone="ghost" onPress={() => void refreshFromBackend()} />
        <PrimaryButton
          label={showForm ? "Close" : "New event"}
          icon={showForm ? "close" : "add"}
          tone={showForm ? "soft" : "primary"}
          onPress={() => setShowForm((value) => !value)}
        />
        <PrimaryButton
          label="Calendar sync"
          icon="calendar"
          tone="soft"
          onPress={() => setShowCalendarSync(true)}
        />
      </View>
      <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>

      <Card>
        <View style={styles.snapshotRow}>
          <View style={styles.snapshotBlock}>
            <Text style={styles.snapshotLabel}>Next up</Text>
            <Text style={styles.snapshotValue}>{nextEvent ? nextEvent.title : "The week is still open"}</Text>
            <Text style={styles.snapshotMeta}>
              {nextEvent
                ? `${nextEvent.time}${nextEvent.location ? ` - ${nextEvent.location}` : ""}`
                : "Add the first anchor point for the household."}
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

      {showForm ? (
        <Card>
          <Text style={styles.formTitle}>Create event</Text>
          <TextInput
            accessibilityLabel="Event title"
            placeholder="Title"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Event location"
            placeholder="Location (optional)"
            placeholderTextColor={colors.muted}
            value={location}
            onChangeText={setLocation}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Event start time"
            placeholder='Start time (optional, "18:00")'
            placeholderTextColor={colors.muted}
            value={startTime}
            onChangeText={setStartTime}
            style={styles.input}
          />
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
              label={isSaving ? "Creating..." : "Create"}
              icon="checkmark"
              onPress={() => {
                if (!canSubmit || isSaving) return;
                void createEvent({ title, location, startTime, memberIds }).then((ok) => {
                  if (!ok) return;
                  setTitle("");
                  setLocation("");
                  setStartTime("");
                  setMemberIds([]);
                  setShowForm(false);
                });
              }}
            />
          </View>
        </Card>
      ) : null}

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

      <SectionTitle title="Plans ahead" action="Today" />
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
                    <Text style={styles.meta}>{assigned}</Text>
                    {event.location ? <Text style={styles.location}>{event.location}</Text> : null}
                  </View>
                </Row>
              </Card>
            );
          })
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>Nothing is on the family calendar yet.</Text>
            <Text style={styles.emptyText}>
              Add the first event or import a calendar so HomeThread becomes the place everyone checks each morning.
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
  liveUpdateNote: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md
  },
  syncNote: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
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
