import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { AssistantDraft } from "../types";
import { parseFamilyText } from "../utils/textParser";

const examples = [
  "Soccer moved to 5:30 Friday at Field 2",
  "Buy granola bars and strawberries",
  "Remind Jules to unload dishwasher tonight"
];

export function AssistantScreen() {
  const { commitDraft, isSaving, saveMessage } = useHomeThreadStore();
  const [prompt, setPrompt] = useState(examples[0]);
  const [draft, setDraft] = useState<AssistantDraft>(() => parseFamilyText(examples[0]));
  const [saved, setSaved] = useState(false);

  const parse = (value: string) => {
    setPrompt(value);
    setSaved(false);
    setDraft(value.trim() ? parseFamilyText(value) : parseFamilyText("Add a family item"));
  };

  return (
    <View>
      <Text style={styles.title}>Quick add</Text>
      <Text style={styles.subtitle}>Type the way a family actually texts. HomeThread turns it into the right kind of item.</Text>

      <SectionTitle title="Message" />
      <Card>
        <TextInput
          accessibilityLabel="Family quick add message"
          multiline
          onChangeText={parse}
          style={styles.input}
          value={prompt}
        />
        <View style={styles.exampleRow}>
          {examples.map((example) => (
            <Text key={example} onPress={() => parse(example)} style={styles.example}>
              {example}
            </Text>
          ))}
        </View>
      </Card>

      <SectionTitle title="Draft" />
      <Card>
        <View style={styles.draftTop}>
          <Pill label={draft.kind} tone={draft.kind === "event" ? "primary" : draft.kind === "chore" ? "gold" : "mint"} />
          <Text style={styles.confidence}>{Math.round(draft.confidence * 100)}%</Text>
        </View>
        <Text style={styles.draftTitle}>{draft.title}</Text>
        <Text style={styles.meta}>{draft.detail}</Text>
        <Text style={styles.saveStatus}>{saveMessage}</Text>
        <View style={styles.saveRow}>
          <PrimaryButton
            label={isSaving ? "Saving..." : saved ? "Saved" : "Save to HomeThread"}
            icon={isSaving ? "sync" : saved ? "checkmark" : "add"}
            onPress={() => {
              void commitDraft(draft).then(() => {
                setSaved(true);
              });
            }}
          />
        </View>
      </Card>
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
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 17,
    minHeight: 120,
    padding: spacing.md,
    textAlignVertical: "top"
  },
  exampleRow: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  example: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    padding: spacing.md
  },
  draftTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg
  },
  confidence: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  draftTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  saveStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.md
  },
  saveRow: {
    marginTop: spacing.lg
  }
});
