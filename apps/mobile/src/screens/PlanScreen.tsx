import { StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, Row, SectionTitle } from "../components/Primitives";
import { colors, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function PlanScreen() {
  const { events, members } = useHomeThreadStore();

  return (
    <View>
      <Text style={styles.title}>Family plan</Text>
      <Text style={styles.subtitle}>A shared timeline that still works when the update travels by text.</Text>

      <SectionTitle title="People" />
      <View style={styles.peopleRow}>
        {members.map((member) => (
          <Card key={member.id}>
            <View style={styles.personCard}>
              <MemberAvatar member={member} />
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
