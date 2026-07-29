import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { FieldError, Pill, PrimaryButton } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";
import { AssistantAssistResponse, AssistantDraft, TextUpdate } from "../types";
import { parseFamilyText } from "../utils/textParser";
import { safeArray } from "../utils/safeRender";
import { formatThreadConversion, formatThreadDirection } from "../utils/threadLabels";

function formatDraftKind(kind: AssistantDraft["kind"]) {
  if (kind === "event") return "Plan event";
  if (kind === "chore") return "Chore";
  if (kind === "list") return "List item";
  if (kind === "meal") return "Meal";
  return kind;
}

export function ThreadScreen({
  onBack,
  pinnedHeader = false
}: { onBack?: () => void; pinnedHeader?: boolean } = {}) {
  const {
    textUpdates,
    commitDraft,
    sendDigestToThread,
    syncSource,
    syncMessage,
    isHydrating,
    realtimeStatus,
    realtimeMessage
  } = useHomeThreadStore();
  const isSavingBoard = useHomeThreadStore(isHomeThreadSavingScope("board"));
  const [body, setBody] = useState("");
  const [lastDraft, setLastDraft] = useState<AssistantDraft | null>(null);
  const [draftSource, setDraftSource] = useState<"ai" | "local" | null>(null);
  const [isReviewingImport, setIsReviewingImport] = useState(false);
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [boardSuccess, setBoardSuccess] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);

  const boardUpdates = safeArray(textUpdates);

  useEffect(() => {
    if (!boardSuccess && !boardError && !importSuccess && !importInfo) {
      return;
    }

    const timer = setTimeout(() => {
      setBoardSuccess(null);
      setBoardError(null);
      setImportSuccess(null);
      setImportInfo(null);
    }, boardError ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [boardSuccess, boardError, importSuccess, importInfo]);

  useEffect(() => {
    if (!highlightEntryId) {
      return;
    }

    const timer = setTimeout(() => setHighlightEntryId(null), 3500);
    return () => clearTimeout(timer);
  }, [highlightEntryId]);

  async function openSms(digest: string) {
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${separator}body=${encodeURIComponent(digest)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setBoardSuccess(null);
        setBoardError("This device can't open a texting app. Copy the summary above to share it instead.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      setBoardSuccess(null);
      setBoardError("Couldn't open a texting app. Copy the summary above to share it instead.");
    }
  }

  function openImportModal() {
    setBody("");
    setLastDraft(null);
    setDraftSource(null);
    setImportError(null);
    setImportInfo(null);
    setShowImportModal(true);
  }

  function closeImportModal() {
    if (isSavingBoard || isReviewingImport) return;
    setShowImportModal(false);
  }

  async function reviewImportText() {
    const trimmed = body.trim();
    if (!trimmed) {
      setImportError("Paste family text before parsing.");
      setImportInfo(null);
      return;
    }

    setImportError(null);
    setImportInfo(null);
    setIsReviewingImport(true);

    if (syncSource === "api") {
      const result = await apiRequest<AssistantAssistResponse>("/ai/assist", {
        method: "POST",
        body: JSON.stringify({ message: trimmed, intent: "import_text" })
      });

      if (result.data?.mode === "ai") {
        setIsReviewingImport(false);
        if (result.data.draft) {
          setLastDraft(result.data.draft);
          setDraftSource("ai");
          setImportInfo("Check the AI suggestion, then save.");
          return;
        }

        setImportError(
          result.data.message || "Couldn't find a clear plan, chore, or list item in that text."
        );
        return;
      }

      if (result.error?.code === "PLUS_REQUIRED") {
        const localDraft = parseFamilyText(trimmed);
        setLastDraft(localDraft);
        setDraftSource("local");
        setImportInfo("AI import is a Plus feature — using a local guess for now. Review before saving.");
        setIsReviewingImport(false);
        return;
      }
    }

    const localDraft = parseFamilyText(trimmed);
    setLastDraft(localDraft);
    setDraftSource("local");
    setImportInfo(
      syncSource === "api"
        ? "AI suggestion unavailable right now — using a local guess. Review before saving."
        : "Check the suggestion, then save."
    );
    setIsReviewingImport(false);
  }

  function saveImportedDraft() {
    if (!lastDraft || isSavingBoard) return;
    const draftTitle = lastDraft.title;
    void commitDraft(lastDraft).then((outcome) => {
      if (outcome.kind === "failed") {
        setImportError(outcome.message);
        setImportInfo(null);
        return;
      }

      if (outcome.kind === "local") {
        setShowImportModal(false);
        setImportSuccess(null);
        setImportInfo(
          `Saved "${draftTitle}" on this device only. Pull to refresh when the connection is steady.`
        );
        return;
      }

      const latestEntry = useHomeThreadStore.getState().textUpdates[0];
      if (latestEntry) {
        setHighlightEntryId(latestEntry.id);
      }
      setShowImportModal(false);
      setImportInfo(null);
      setImportSuccess(`Added "${draftTitle}" to your household.`);
    });
  }

  function postSummary() {
    const digest = sendDigestToThread();
    setLastDigest(digest);
    const latestEntry = useHomeThreadStore.getState().textUpdates[0];
    if (latestEntry) {
      setHighlightEntryId(latestEntry.id);
    }
    setBoardError(null);
    setBoardSuccess("Summary added to the board.");
  }

  return (
    <View style={styles.screen}>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>📋</Text>
          </View>
          <Text style={styles.largeTitleText}>Family board</Text>
        </View>
      ) : (
        <ScreenHeader
          title="Family board"
          actionLabel="Back"
          actionIcon="chevron-back"
          onActionPress={onBack}
          density="compact"
        />
      )}

      <View style={styles.plannerCard}>
        <Text style={styles.cardCaption}>
          Not a chat — turn a pasted text into a plan, or post a summary. Saved on this device only.
        </Text>
        <View style={styles.tileRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import a family text"
            onPress={openImportModal}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <Text style={styles.tileGlyph}>📥</Text>
            <Text style={styles.tileLabel}>Import text</Text>
            <Text style={styles.tileHint}>AI-read · review · save</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a summary to the board"
            onPress={postSummary}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <Text style={styles.tileGlyph}>📣</Text>
            <Text style={styles.tileLabel}>Post summary</Text>
            <Text style={styles.tileHint}>Plans · chores · list</Text>
          </Pressable>
        </View>
      </View>

      <SyncStatusRow
        syncSource={syncSource}
        syncMessage={syncMessage}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
      />
      <ActionFeedback message={importSuccess ?? ""} tone="success" visible={Boolean(importSuccess)} />
      <ActionFeedback message={importInfo ?? ""} tone="info" visible={Boolean(importInfo)} />
      <ActionFeedback message={boardSuccess ?? ""} tone="success" visible={Boolean(boardSuccess)} />
      <ActionFeedback message={boardError ?? ""} tone="error" visible={Boolean(boardError)} />

      {lastDigest ? (
        <View style={styles.digestCard}>
          <View style={styles.digestHeader}>
            <Text style={styles.digestTitle}>Latest summary</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send summary with SMS"
              onPress={() => void openSms(lastDigest)}
              style={({ pressed }) => [styles.smsButton, pressed && styles.smsButtonPressed]}
            >
              <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
              <Text style={styles.smsButtonText}>Send via SMS</Text>
            </Pressable>
          </View>
          <Text style={styles.digestText}>{lastDigest}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.sectionHeaderRule} />
        <Text style={styles.sectionCount}>{boardUpdates.length}</Text>
      </View>

      {boardUpdates.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>Nothing here yet.</Text>
          <Text style={styles.emptyText}>Import a family text or post a summary to start the log.</Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {boardUpdates.map((update, index) => (
            <ThreadEntry
              key={update.id}
              update={update}
              highlighted={update.id === highlightEntryId}
              isLast={index === boardUpdates.length - 1}
            />
          ))}
        </View>
      )}

      {/* Import text modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeImportModal}
      >
        <SafeAreaView style={styles.composeSafe}>
          <KeyboardAvoidingView style={styles.composeRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composeStage}>
              <View style={styles.composePanel}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Text style={styles.composeHeaderGlyph}>📥</Text>
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>Import text</Text>
                    <Text style={styles.composeHint}>
                      Paste a message from the family group chat and we'll suggest what to save.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingBoard}
                    onPress={closeImportModal}
                    style={styles.composeCancelHit}
                  >
                    <Text style={styles.composeCancelText}>Cancel</Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.composeScroll}
                  contentContainerStyle={styles.composeScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Pasted text</Text>
                    <TextInput
                      accessibilityLabel="Paste a family text"
                      multiline
                      onChangeText={(value) => {
                        setBody(value);
                        setImportError(null);
                        if (lastDraft) {
                          setLastDraft(null);
                          setDraftSource(null);
                        }
                      }}
                      placeholder="Paste the group text here..."
                      placeholderTextColor={colors.muted}
                      style={[styles.input, importError && !lastDraft ? styles.inputInvalid : null]}
                      value={body}
                    />
                    <FieldError message={importError && !lastDraft ? importError : null} />
                  </View>

                  {!lastDraft ? (
                    <PrimaryButton
                      label={isReviewingImport ? "Reading..." : "Review suggestion"}
                      icon="reader-outline"
                      loading={isReviewingImport}
                      disabled={isReviewingImport}
                      onPress={() => void reviewImportText()}
                    />
                  ) : (
                    <View style={styles.reviewResult}>
                      <View style={styles.reviewResultHeader}>
                        <View style={styles.reviewResultBadges}>
                          <Pill label={formatDraftKind(lastDraft.kind)} tone="mint" />
                          {draftSource === "ai" ? (
                            <Pill label="AI suggestion" tone="primary" icon="sparkles" />
                          ) : (
                            <Pill label="Quick guess" tone="neutral" />
                          )}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Clear suggestion and try again"
                          onPress={() => {
                            setLastDraft(null);
                            setDraftSource(null);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <Text style={styles.reviewResultRetry}>Try again</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.reviewResultText}>{lastDraft.title}</Text>
                      <Text style={styles.reviewResultMeta}>{lastDraft.detail}</Text>
                    </View>
                  )}
                  <FieldError message={importError && lastDraft ? importError : null} />
                </ScrollView>

                {lastDraft ? (
                  <View style={styles.composeFooter}>
                    <PrimaryButton
                      label={isSavingBoard ? "Saving..." : "Save to household"}
                      icon="checkmark"
                      loading={isSavingBoard}
                      disabled={isSavingBoard}
                      onPress={saveImportedDraft}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function ThreadEntry({
  update,
  highlighted,
  isLast
}: {
  update: TextUpdate;
  highlighted?: boolean;
  isLast: boolean;
}) {
  const conversion = formatThreadConversion(update.convertedTo);
  const directionLabel = formatThreadDirection(update.direction);
  const isOutbound = update.direction === "outbound";

  return (
    <View style={styles.entryRow}>
      <View style={styles.railColumn}>
        <View style={[styles.railDot, isOutbound ? styles.railDotOutbound : styles.railDotInbound]}>
          <Ionicons name={isOutbound ? "send" : "chatbubble-ellipses"} size={12} color="#FFFFFF" />
        </View>
        {!isLast ? <View style={styles.railLine} /> : null}
      </View>
      <View style={[styles.entryCard, highlighted && styles.entryCardHighlighted]}>
        <View style={styles.entryMetaRow}>
          <Text style={styles.author} numberOfLines={1}>
            {update.author}
          </Text>
          <Text style={styles.time}>{update.createdAt}</Text>
        </View>
        <View style={styles.entryPills}>
          <Pill label={directionLabel} tone={isOutbound ? "primary" : "neutral"} />
          {conversion ? <Pill label={conversion} tone="mint" /> : null}
        </View>
        <Text style={styles.body}>{update.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    paddingBottom: 96
  },
  // Large title (collapses into the pinned bar on scroll)
  largeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.md
  },
  largeTitleIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  largeTitleGlyph: {
    fontSize: 20
  },
  largeTitleText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3
  },
  // Action tiles card
  plannerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadow.card
  },
  cardCaption: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18
  },
  tileRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  tile: {
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  tilePressed: {
    backgroundColor: colors.primarySoft
  },
  tileGlyph: {
    fontSize: 20
  },
  tileLabel: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginTop: 2
  },
  tileHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  // Digest preview card
  digestCard: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  digestHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  digestTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  smsButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  smsButtonPressed: {
    opacity: 0.65
  },
  smsButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  digestText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  // Section header
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 2
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
    lineHeight: 18
  },
  sectionHeaderRule: {
    backgroundColor: colors.line,
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  // Empty state
  emptyBlock: {
    paddingHorizontal: 2,
    paddingVertical: 12
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 4
  },
  // Timeline
  timeline: {
    gap: 2
  },
  entryRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  railColumn: {
    alignItems: "center",
    width: 24
  },
  railDot: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24
  },
  railDotInbound: {
    backgroundColor: colors.coral
  },
  railDotOutbound: {
    backgroundColor: colors.primary
  },
  railLine: {
    backgroundColor: colors.line,
    flex: 1,
    marginVertical: 4,
    width: StyleSheet.hairlineWidth * 2
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 6,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  entryCardHighlighted: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.24)"
  },
  entryMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
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
  entryPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  body: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  },
  // Compose modal (import)
  composeSafe: {
    backgroundColor: "#EDE4D6",
    flex: 1
  },
  composeRoot: {
    flex: 1
  },
  composeStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  composePanel: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    maxHeight: "82%",
    maxWidth: 440,
    overflow: "hidden",
    width: "100%",
    ...shadow.card
  },
  composeHeader: {
    alignItems: "flex-start",
    backgroundColor: colors.goldSoft,
    borderBottomColor: "rgba(153,106,0,0.14)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 14,
    paddingHorizontal: spacing.md,
    paddingTop: 14
  },
  composeHeaderMark: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(153,106,0,0.18)",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    marginTop: 2,
    width: 36
  },
  composeHeaderGlyph: {
    fontSize: 17
  },
  composeHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs
  },
  composeTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 26
  },
  composeHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 3
  },
  composeCancelHit: {
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 2,
    paddingVertical: 4
  },
  composeCancelText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  composeScroll: {
    backgroundColor: colors.surface,
    flexGrow: 0,
    flexShrink: 1
  },
  composeScrollContent: {
    gap: 12,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  composeFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? spacing.md : spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  formField: {
    gap: 6
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: "top"
  },
  inputInvalid: {
    borderColor: colors.coral
  },
  reviewResult: {
    backgroundColor: colors.mintSoft,
    borderRadius: radii.md,
    gap: 4,
    padding: spacing.md
  },
  reviewResultHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: 2
  },
  reviewResultBadges: {
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: spacing.xs
  },
  reviewResultRetry: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  reviewResultText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  reviewResultMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  }
});
