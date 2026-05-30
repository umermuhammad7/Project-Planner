import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function ChoresScreen() {
  const { chores, members, completeChore, createChore, refreshFromBackend, isSaving, isHydrating, saveMessage, syncSource, realtimeStatus, realtimeMessage } =
    useHomeThreadStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  return (
    <View>
      <Text style={styles.title}>Chores</Text>
      <Text style={styles.subtitle}>Small, visible wins with rewards that kids can understand.</Text>

      <SyncStatusRow
        syncSource={syncSource}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
        showLiveNote
      />

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
              label={isSaving ? "Creating..." : "Create"}
              icon="checkmark"
              onPress={() => {
                if (!canSubmit || isSaving) return;
                void createChore({ title, dueTime, assignedTo }).then((ok) => {
                  if (!ok) return;
                  setTitle("");
                  setDueTime("");
                  setAssignedTo(null);
                  setShowForm(false);
                });
              }}
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Due today" />
      <View style={styles.stack}>
        {chores.length > 0 ? (
          chores.map((chore) => {
            const member = members.find((item) => item.id === chore.assignedTo) ?? members[0];
            return (
              <Pressable
                key={chore.id}
                accessibilityRole="button"
                accessibilityLabel={`${chore.completed ? "Completed" : "Complete"} ${chore.title}${
                  chore.completed ? ". Reopen is not available yet." : ""
                }`}
                onPress={() => void completeChore(chore.id)}
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
          })
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>No chores yet.</Text>
            <Text style={styles.emptyText}>
              Add the first recurring chore so kids and adults both know what done for today looks like.
            </Text>
          </Card>
        )}
      </View>

      <SectionTitle title="Reward balances" />
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
  liveUpdateNote: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
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
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.sm
  }
});
