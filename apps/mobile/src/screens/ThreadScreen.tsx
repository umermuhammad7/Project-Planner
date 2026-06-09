import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useMemo, useState } from "react";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { AssistantDraft, TextUpdate } from "../types";
import { formatThreadConversion, formatThreadDirection } from "../utils/threadLabels";

export function ThreadScreen() {
  const {
    textUpdates,
    importText,
    commitDraft,
    sendDigestToThread,
    isSaving,
    saveMessage,
    syncSource,
    isHydrating,
    realtimeStatus,
    realtimeMessage
  } = useHomeThreadStore();
  const [body, setBody] = useState("Grandma can grab bananas after Noah soccer at 5");
  const [lastDraft, setLastDraft] = useState<AssistantDraft | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  const inboundUpdates = useMemo(
    () => textUpdates.filter((update) => update.direction === "inbound"),
    [textUpdates]
  );
  const outboundUpdates = useMemo(
    () => textUpdates.filter((update) => update.direction === "outbound"),
    [textUpdates]
  );

  const openSms = async (digest: string) => {
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${separator}body=${encodeURIComponent(digest)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Family board</Text>
      <Text style={styles.subtitle}>
        Turn messy texts into clear household updates. SMS is optional - the thread history lives here first.
      </Text>

      <SyncStatusRow
        syncSource={syncSource}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
      />

      <SectionTitle title="Digest" />
      <Card>
        <Text style={styles.label}>Send a clean summary</Text>
        <Text style={styles.meta}>
          Builds a digest from today's plans, chores, and lists. Saving adds an outbound entry below; SMS only
          pre-fills your phone's message app.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label="Save digest to thread"
            icon="send"
            onPress={() => {
              const digest = sendDigestToThread();
              setLastDigest(digest);
            }}
          />
          <PrimaryButton
            label="Open SMS"
            icon="chatbubble"
            tone="soft"
            onPress={() => {
              if (!lastDigest) return;
              void openSms(lastDigest);
            }}
          />
        </View>
        {lastDigest ? (
          <View style={styles.preview}>
            <Pill label="Outbound preview" tone="neutral" />
            <Text style={styles.previewText}>{lastDigest}</Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="Text import" />
      <Card>
        <Text style={styles.label}>Paste a family text</Text>
        <Text style={styles.meta}>
          HomeThread suggests an event, chore, or list item. Review the draft before saving - nothing sends automatically.
        </Text>
        <TextInput
          accessibilityLabel="Paste a family text"
          multiline
          onChangeText={setBody}
          placeholder="Paste the group text here..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={body}
        />
        <View style={styles.actions}>
          <PrimaryButton
            label="Parse text"
            icon="sparkles"
            tone="soft"
            onPress={() => {
              if (body.trim()) {
                setLastDraft(importText(body.trim()));
              }
            }}
          />
          <PrimaryButton
            label={isSaving ? "Saving..." : "Save to app"}
            icon="checkmark"
            onPress={() => {
              if (!lastDraft || isSaving) return;
              void commitDraft(lastDraft).then(() => {
                setLastDraft(null);
              });
            }}
          />
        </View>
        <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>
        {lastDraft ? (
          <View style={styles.result}>
            <Pill label={lastDraft.kind} tone="mint" />
            <Text style={styles.resultText}>{lastDraft.title}</Text>
            <Text style={styles.meta}>{Math.round(lastDraft.confidence * 100)}% parser confidence - review before saving</Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="Thread history" action={`${textUpdates.length} entries`} />
      {textUpdates.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No thread entries yet</Text>
          <Text style={styles.meta}>
            Save a digest or import a family text to start a readable history of what came from where.
          </Text>
        </Card>
      ) : (
        <View style={styles.stack}>
          {inboundUpdates.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>From family texts</Text>
              {inboundUpdates.map((update) => (
                <ThreadEntry key={update.id} update={update} />
              ))}
            </>
          ) : null}
          {outboundUpdates.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>From HomeThread</Text>
              {outboundUpdates.map((update) => (
                <ThreadEntry key={update.id} update={update} />
              ))}
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

function ThreadEntry({ update }: { update: TextUpdate }) {
  const conversion = formatThreadConversion(update.convertedTo);
  const directionLabel = formatThreadDirection(update.direction);

  return (
    <Card>
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
          <Pill label={directionLabel} tone={update.direction === "outbound" ? "primary" : "neutral"} />
          <Text style={styles.body}>{update.body}</Text>
          {conversion ? <Pill label={conversion} tone="mint" /> : null}
        </View>
      </Row>
    </Card>
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
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
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
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  preview: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md
  },
  previewText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
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
    fontWeight: "800"
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
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
    fontWeight: "800"
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21
  }
});

