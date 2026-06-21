import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

import { ActionFeedback } from "../components/ActionFeedback";
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
    syncSource,
    syncMessage,
    isHydrating,
    realtimeStatus,
    realtimeMessage
  } = useHomeThreadStore();
  const [body, setBody] = useState("");
  const [lastDraft, setLastDraft] = useState<AssistantDraft | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [boardSuccess, setBoardSuccess] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);

  const inboundUpdates = useMemo(
    () => textUpdates.filter((update) => update.direction === "inbound"),
    [textUpdates]
  );
  const outboundUpdates = useMemo(
    () => textUpdates.filter((update) => update.direction === "outbound"),
    [textUpdates]
  );

  useEffect(() => {
    if (!boardSuccess && !importSuccess && !importInfo) {
      return;
    }

    const timer = setTimeout(() => {
      setBoardSuccess(null);
      setImportSuccess(null);
      setImportInfo(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [boardSuccess, importSuccess, importInfo]);

  useEffect(() => {
    if (!highlightEntryId) {
      return;
    }

    const timer = setTimeout(() => setHighlightEntryId(null), 3500);
    return () => clearTimeout(timer);
  }, [highlightEntryId]);

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
        Shared updates, saved digests, and converted family texts live here. This is the household board, not a live chat yet.
      </Text>

      <SyncStatusRow
        syncSource={syncSource}
        syncMessage={syncMessage}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
      />

      <SectionTitle title="Share an update" />
      <Card>
        <Text style={styles.label}>Share a clean summary</Text>
        <Text style={styles.meta}>
          Save a readable household summary to the board below. Send with SMS only pre-fills your phone's message app -
          nothing sends automatically.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label="Add summary to family board"
            icon="bookmark"
            onPress={() => {
              const digest = sendDigestToThread();
              setLastDigest(digest);
              const latestEntry = useHomeThreadStore.getState().textUpdates[0];
              if (latestEntry) {
                setHighlightEntryId(latestEntry.id);
              }
              setBoardSuccess("Summary added to the family board.");
            }}
          />
          <PrimaryButton
            label="Send with SMS"
            icon="chatbubble"
            tone="soft"
            disabled={!lastDigest}
            onPress={() => {
              if (!lastDigest) return;
              void openSms(lastDigest);
            }}
          />
        </View>
        <ActionFeedback message={boardSuccess ?? ""} tone="success" visible={Boolean(boardSuccess)} />
        {lastDigest ? (
          <View style={styles.preview}>
            <Pill label="Board preview" tone="neutral" />
            <Text style={styles.previewText}>{lastDigest}</Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="Import a message" />
      <Card>
        <Text style={styles.label}>Paste a family text</Text>
        <Text style={styles.meta}>
          Paste a family message and HomeThread will suggest an event, chore, or list item before anything is saved.
        </Text>
        <TextInput
          accessibilityLabel="Paste a family text"
          multiline
          onChangeText={(value) => {
            setBody(value);
            setImportError(null);
          }}
          placeholder="Paste the group text here..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={body}
        />
        <View style={styles.actions}>
          <PrimaryButton
            label="Review suggestion"
            icon="sparkles"
            tone="soft"
            onPress={() => {
              if (!body.trim()) {
                setImportError("Paste family text before parsing.");
                setImportSuccess(null);
                setImportInfo(null);
                return;
              }

              setImportError(null);
              setImportSuccess(null);
              setImportInfo(null);
              setLastDraft(importText(body.trim()));
            }}
          />
          <PrimaryButton
            label={isSaving ? "Saving..." : "Save suggestion"}
            icon="checkmark"
            loading={isSaving}
            disabled={!lastDraft || isSaving}
            onPress={() => {
              if (!lastDraft || isSaving) return;
              const draftTitle = lastDraft.title;
              void commitDraft(lastDraft).then((outcome) => {
                if (outcome.kind === "failed") {
                  setImportError(outcome.message);
                  setImportSuccess(null);
                  setImportInfo(null);
                  return;
                }

                if (outcome.kind === "local") {
                  setImportInfo(`Saved "${draftTitle}" on this device only. Pull to refresh when the connection is steady.`);
                  setImportSuccess(null);
                  setImportError(null);
                  setLastDraft(null);
                  setBody("");
                  return;
                }

                const latestEntry = useHomeThreadStore.getState().textUpdates[0];
                if (latestEntry) {
                  setHighlightEntryId(latestEntry.id);
                }
                setImportSuccess(`Added "${draftTitle}" to your household.`);
                setImportInfo(null);
                setImportError(null);
                setLastDraft(null);
                setBody("");
              });
            }}
          />
        </View>
        <ActionFeedback message={importSuccess ?? ""} tone="success" visible={Boolean(importSuccess)} />
        <ActionFeedback message={importInfo ?? ""} tone="info" visible={Boolean(importInfo)} />
        <ActionFeedback message={importError ?? ""} tone="error" visible={Boolean(importError)} />
        {lastDraft ? (
          <View style={styles.result}>
            <Pill label={lastDraft.kind} tone="mint" />
            <Text style={styles.resultText}>{lastDraft.title}</Text>
            <Text style={styles.meta}>{Math.round(lastDraft.confidence * 100)}% confidence - review this suggestion, then save it if it looks right.</Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="Board history" action={`${textUpdates.length} entries`} />
      {textUpdates.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No thread entries yet</Text>
          <Text style={styles.meta}>
            Add a summary to the family board or import a family text to start a readable history of what came from where.
          </Text>
        </Card>
      ) : (
        <View style={styles.stack}>
          {inboundUpdates.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>From family texts</Text>
              {inboundUpdates.map((update) => (
                <ThreadEntry key={update.id} update={update} highlighted={update.id === highlightEntryId} />
              ))}
            </>
          ) : null}
          {outboundUpdates.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>From HomeThread</Text>
              {outboundUpdates.map((update) => (
                <ThreadEntry key={update.id} update={update} highlighted={update.id === highlightEntryId} />
              ))}
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

function ThreadEntry({ update, highlighted }: { update: TextUpdate; highlighted?: boolean }) {
  const conversion = formatThreadConversion(update.convertedTo);
  const directionLabel = formatThreadDirection(update.direction);

  return (
    <Card>
      <View style={highlighted ? styles.highlightedEntry : undefined}>
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
      </View>
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
  highlightedEntry: {
    backgroundColor: colors.mintSoft,
    borderRadius: radii.md,
    margin: -spacing.xs,
    padding: spacing.xs
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
