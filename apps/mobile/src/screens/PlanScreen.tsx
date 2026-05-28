import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function PlanScreen() {
  const { events, members, createEvent, refreshFromBackend, isSaving, isHydrating, saveMessage, syncSource, syncMessage } =
    useHomeThreadStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);
  const toggleMember = (id: string) => {
    setMemberIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  return (
    <View>
      <Text style={styles.title}>Family plan</Text>
      <Text style={styles.subtitle}>A shared timeline that still works when the update travels by text.</Text>

      <View style={styles.statusRow}>
        <Pill
          label={syncSource === "api" ? "Local backend connected" : "Prototype mode"}
          tone={syncSource === "api" ? "primary" : "neutral"}
          icon={syncSource === "api" ? "sparkles" : "information-circle"}
        />
        <Text style={styles.syncNote}>{isHydrating ? "Refreshing..." : syncMessage}</Text>
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton label={isHydrating ? "Refreshing..." : "Refresh"} icon="sync" onPress={() => void refreshFromBackend()} />
        <PrimaryButton
          label={showForm ? "Close" : "New event"}
          icon={showForm ? "close" : "add"}
          tone="dark"
          onPress={() => setShowForm((value) => !value)}
        />
      </View>
      <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>

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

      <SectionTitle title="People" />
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

      <SectionTitle title="Timeline" action="Today" />
      <View style={styles.stack}>
        {events.map((event) => {
          const assigned = event.assignedTo
            .map((id) => members.find((member) => member.id === id)?.name)
            .filter(Boolean)
            .join(", ");

          return (
            <Card key={event.id}>
              <Row align="flex-start">
                <View style={styles.rail}>
                  <View style={styles.dot} />
                  <View style={styles.line} />
                </View>
                <View style={styles.fill}>
                  <Row>
                    <Text style={styles.time}>{event.time}</Text>
                    <Pill label={event.source} tone={event.source === "assistant" ? "mint" : "primary"} />
                  </Row>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.meta}>{assigned}</Text>
                  {event.location ? <Text style={styles.location}>{event.location}</Text> : null}
                </View>
              </Row>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
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
    fontWeight: "800",
    marginTop: spacing.sm
  },
  formTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
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
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
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
    fontWeight: "900"
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
    fontWeight: "900"
  },
  eventTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
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
  }
});
