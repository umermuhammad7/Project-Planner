import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { AssistantDraft } from "../types";
import { useState } from "react";

export function ThreadScreen() {
  const { textUpdates, importText, sendDigestToThread } = useHomeThreadStore();
  const [body, setBody] = useState("Grandma can grab bananas after Noah soccer at 5");
  const [lastDraft, setLastDraft] = useState<AssistantDraft | null>(null);

  const sendSms = async () => {
    const digest = sendDigestToThread();
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${separator}body=${encodeURIComponent(digest)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Family thread</Text>
      <Text style={styles.subtitle}>Use SMS as the bridge, not the source of chaos.</Text>

      <SectionTitle title="Text import" />
      <Card>
        <Text style={styles.label}>Paste a family text</Text>
        <TextInput
          accessibilityLabel="Paste a family text"
          multiline
          onChangeText={setBody}
          style={styles.input}
          value={body}
        />
        <View style={styles.actions}>
          <PrimaryButton
            label="Turn into item"
            icon="sparkles"
            onPress={() => {
              if (body.trim()) {
                setLastDraft(importText(body.trim()));
              }
            }}
          />
          <PrimaryButton label="Open SMS" icon="chatbubble" tone="dark" onPress={sendSms} />
        </View>
        {lastDraft ? (
          <View style={styles.result}>
            <Pill label={lastDraft.kind} tone="mint" />
            <Text style={styles.resultText}>{lastDraft.title}</Text>
            <Text style={styles.meta}>{Math.round(lastDraft.confidence * 100)}% parser confidence</Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="Recent updates" />
      <View style={styles.stack}>
        {textUpdates.map((update) => (
          <Card key={update.id}>
            <Row align="flex-start">
              <View style={[styles.bubbleIcon, update.direction === "outbound" && styles.bubbleIconOutbound]}>
                <Ionicons
                  name={update.direction === "outbound" ? "send" : "chatbubble-ellipses"}
                  size={18}
                  color={update.direction === "outbound" ? colors.primary : colors.coral}
                />
              </View>
              <View style={styles.fill}>
                <Row>
                  <Text style={styles.author}>{update.author}</Text>
                  <Text style={styles.time}>{update.createdAt}</Text>
                </Row>
                <Text style={styles.body}>{update.body}</Text>
                {update.convertedTo ? <Pill label={`saved as ${update.convertedTo}`} tone="primary" /> : null}
              </View>
            </Row>
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
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: spacing.sm
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 92,
    padding: spacing.md,
    textAlignVertical: "top"
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md
  },
  result: {
    backgroundColor: colors.mintSoft,
    borderRadius: radii.md,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md
  },
  resultText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  stack: {
    gap: spacing.md
  },
  bubbleIcon: {
    alignItems: "center",
    backgroundColor: colors.coralSoft,
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  bubbleIconOutbound: {
    backgroundColor: colors.primarySoft
  },
  fill: {
    flex: 1,
    gap: spacing.sm
  },
  author: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "900"
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21
  }
});
