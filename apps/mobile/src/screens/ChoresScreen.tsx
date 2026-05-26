import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, Row, SectionTitle } from "../components/Primitives";
import { colors, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function ChoresScreen() {
  const { chores, members, toggleChore } = useHomeThreadStore();

  return (
    <View>
      <Text style={styles.title}>Chores</Text>
      <Text style={styles.subtitle}>Small, visible wins with rewards that kids can understand.</Text>

      <SectionTitle title="Due today" />
      <View style={styles.stack}>
        {chores.map((chore) => {
          const member = members.find((item) => item.id === chore.assignedTo) ?? members[0];
          return (
            <Pressable
              key={chore.id}
              accessibilityRole="button"
              accessibilityLabel={`${chore.completed ? "Reopen" : "Complete"} ${chore.title}`}
              onPress={() => toggleChore(chore.id)}
            >
              <Card>
                <Row>
                  <View style={[styles.check, chore.completed && styles.checkDone]}>
                    <Ionicons
                      name={chore.completed ? "checkmark" : "ellipse-outline"}
                      size={20}
                      color={chore.completed ? "#FFFFFF" : colors.muted}
                    />
                  </View>
                  <View style={styles.fill}>
                    <Text style={[styles.choreTitle, chore.completed && styles.doneText]}>{chore.title}</Text>
                    <Text style={styles.meta}>{chore.dueLabel}</Text>
                  </View>
                  <MemberAvatar member={member} size={34} />
                  <Pill label={`${chore.stars} stars`} tone="gold" icon="star" />
                </Row>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title="Reward balances" />
      <View style={styles.rewardGrid}>
        {members
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
          ))}
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
  stack: {
    gap: spacing.md
  },
  fill: {
    flex: 1
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
    fontWeight: "900"
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
  }
});
