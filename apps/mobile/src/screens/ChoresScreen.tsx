import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function ChoresScreen() {
  const { chores, members, toggleChore, createChore, refreshFromBackend, isSaving, isHydrating, saveMessage } =
    useHomeThreadStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  return (
    <View>
      <Text style={styles.title}>Chores</Text>
      <Text style={styles.subtitle}>Small, visible wins with rewards that kids can understand.</Text>

      <View style={styles.actionRow}>
        <PrimaryButton label={isHydrating ? "Refreshing..." : "Refresh"} icon="sync" onPress={() => void refreshFromBackend()} />
        <PrimaryButton
          label={showForm ? "Close" : "New chore"}
          icon={showForm ? "close" : "add"}
          tone="dark"
          onPress={() => setShowForm((value) => !value)}
        />
      </View>
      <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>

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
          <TextInput
            accessibilityLabel="Chore due time"
            placeholder='Due time (optional, "18:00")'
            placeholderTextColor={colors.muted}
            value={dueTime}
            onChangeText={setDueTime}
            style={styles.input}
          />
          <View style={styles.formActions}>
            <PrimaryButton
              label={isSaving ? "Creating..." : "Create"}
              icon="checkmark"
              onPress={() => {
                if (!canSubmit || isSaving) return;
                void createChore({ title, dueTime }).then((ok) => {
                  if (!ok) return;
                  setTitle("");
                  setDueTime("");
                  setShowForm(false);
                });
              }}
            />
          </View>
        </Card>
      ) : null}

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
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
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
