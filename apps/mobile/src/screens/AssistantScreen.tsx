import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Pill, PrimaryButton } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import {
  AssistantAssistResponse,
  AssistantContext,
  AssistantDraft,
  AssistantIntent,
  AssistantMealSuggestResponse,
  AssistantMealSuggestion
} from "../types";
import { parseFamilyText } from "../utils/textParser";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mealSuggestionKey(suggestion: AssistantMealSuggestion) {
  return `${suggestion.dayOfWeek}-${suggestion.mealType}-${suggestion.title}`;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
};

type AssistantStatus = {
  configured: boolean;
  providers: {
    openai: boolean;
    groqKeys: number;
  };
  streaming: boolean;
};

const timePattern = /\b([1-9]|1[0-2])(:[0-5][0-9])?\s?(am|pm|a\.m\.|p\.m\.)?\b/i;
const datePattern = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const advisoryPatterns = [
  /\bsuggest\b/i,
  /\bmeal plan\b/i,
  /\bplan (?:meals|dinners|the week)\b/i,
  /\bwhat (?:should|do|can|does)\b/i,
  /\bhelp me (?:with|plan)\b/i,
  /\bideas?\s+for\b/i,
  /\bany suggestions\b/i
];

function looksAdvisory(message: string) {
  const lower = message.toLowerCase();
  return advisoryPatterns.some((pattern) => pattern.test(lower));
}

function looksActionable(message: string) {
  const lower = message.toLowerCase();

  if (datePattern.test(lower) || timePattern.test(lower)) {
    return true;
  }

  if (/\b(add|buy|grab|get|pick up|remind|unload|clean|schedule|move|moved)\b/.test(lower)) {
    return true;
  }

  if (/\b(practice|appointment|pickup|dropoff|drop off|meeting|game|dinner|party)\b/.test(lower)) {
    return true;
  }

  if (/\b(dishwasher|laundry|trash|homework|chore)\b/.test(lower)) {
    return true;
  }

  if (/\b(milk|eggs|bread|bananas|grocery|granola|strawberries)\b/.test(lower)) {
    return true;
  }

  return false;
}

function looksLikeGroceryCapture(message: string) {
  const lower = message.toLowerCase();
  return (
    /\b(add|buy|grab|get|need)\b/.test(lower) ||
    /\b(milk|eggs|bread|bananas|grocery|store|target|costco)\b/.test(lower)
  );
}

function shouldUseLocalParse(message: string, intent?: AssistantIntent) {
  const trimmed = message.trim();
  if (!trimmed) {
    return false;
  }

  if (intent === "meal_plan") {
    return false;
  }

  if (intent === "import_text" || intent === "chores") {
    return looksActionable(trimmed) && !looksAdvisory(trimmed);
  }

  if (intent === "grocery_list") {
    return looksLikeGroceryCapture(trimmed);
  }

  if (intent === "general" || !intent) {
    return looksActionable(trimmed) && !looksAdvisory(trimmed);
  }

  return looksActionable(trimmed) && !looksAdvisory(trimmed);
}

function resolveLocalDraft(message: string, intent?: AssistantIntent) {
  if (!shouldUseLocalParse(message, intent)) {
    return null;
  }

  return parseFamilyText(message);
}

const quickPrompts: Array<{ label: string; intent: AssistantIntent; text: string }> = [
  {
    label: "Import family text",
    intent: "import_text",
    text: "Soccer moved to 5:30 Friday at Field 2"
  },
  {
    label: "Suggest a meal plan",
    intent: "meal_plan",
    text: "Suggest a simple dinner plan for our family this week."
  },
  {
    label: "Make a grocery list",
    intent: "grocery_list",
    text: "Add milk, eggs, bread, and bananas to the grocery list."
  },
  {
    label: "Turn into chores",
    intent: "chores",
    text: "Remind Jules to unload the dishwasher tonight."
  },
  {
    label: "What's on today?",
    intent: "day_summary",
    text: "What's on today?"
  }
];

export function AssistantScreen() {
  const { commitDraft, createMeal, familyName, members, events, chores, isSaving, saveMessage, syncSource } = useHomeThreadStore();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [mealSuggestions, setMealSuggestions] = useState<AssistantMealSuggestion[] | null>(null);
  const [savedMealKeys, setSavedMealKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      body: "Paste family text or ask for help. I'll draft it - you save what fits."
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [savedKind, setSavedKind] = useState<"saved" | "local" | null>(null);
  const [draftFeedback, setDraftFeedback] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null
  );
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [assistantStatusMessage, setAssistantStatusMessage] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const { scrollToBottom } = useScrollAssist();

  const canSend = useMemo(() => prompt.trim().length > 0 && !isThinking, [isThinking, prompt]);
  const assistantContext = useMemo<AssistantContext>(() => {
    const upcomingEvents = [...events]
      .sort(compareEventsByStartAt)
      .filter((event) => getEventUrgency(event)?.label !== "Past")
      .slice(0, 5)
      .map((event) => {
        const assignedTo = Array.isArray(event.assignedTo) ? event.assignedTo : [];
        const assignedMemberNames = assignedTo
          .map((id) => members.find((member) => member.id === id)?.name)
          .filter((name): name is string => Boolean(name));

        return {
          title: event.title,
          time: event.time,
          dateLabel: event.dateLabel,
          location: event.location ?? null,
          assignedTo: assignedMemberNames
        };
      });

    const openChores = chores
      .filter((chore) => !chore.completed)
      .slice(0, 5)
      .map((chore) => ({
        title: chore.title,
        dueLabel: chore.dueLabel
      }));

    return {
      familyName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      today: new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      members: members.map((member) => member.name),
      upcomingEvents,
      openChores
    };
  }, [chores, events, familyName, members]);

  useEffect(() => {
    let cancelled = false;

    if (syncSource !== "api") {
      setAssistantStatus(null);
      setAssistantStatusMessage("Sign in to use cloud AI. Preview mode can still draft simple text on this device.");
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const result = await apiRequest<AssistantStatus>("/ai/status");
      if (cancelled) {
        return;
      }

      if (!result.data) {
        setAssistantStatus(null);
        setAssistantStatusMessage(result.error?.message ?? "Could not confirm assistant status.");
        return;
      }

      setAssistantStatus(result.data);

      if (result.data.configured) {
        setAssistantStatusMessage("Cloud AI is available for this household.");
        return;
      }

      setAssistantStatusMessage(
        "This build can parse simple family text. Cloud AI is not configured on the server yet."
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [syncSource]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 80);
    return () => clearTimeout(timer);
  }, [draft, isThinking, mealSuggestions, messages, scrollToBottom]);

  useEffect(() => {
    if (!draftFeedback) {
      return;
    }

    const timer = setTimeout(() => setDraftFeedback(null), draftFeedback.tone === "error" ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [draftFeedback]);

  async function runAssistant(messageText: string, intent?: AssistantIntent) {
    const trimmed = messageText.trim();
    if (!trimmed) {
      return;
    }

    setSavedKind(null);
    setDraftFeedback(null);
    setAssistantNote(null);
    setDraft(null);
    setMealSuggestions(null);
    setSavedMealKeys([]);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", body: trimmed }
    ]);
    setPrompt("");
    setIsThinking(true);

    if (syncSource !== "api") {
      if (intent === "meal_plan") {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            body:
              "Meal suggestions need a signed-in household. For now, add meals on the Meals tab."
          }
        ]);
        setIsThinking(false);
        return;
      }

      if (intent === "day_summary") {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            body: buildLocalDaySummary(assistantContext)
          }
        ]);
        setIsThinking(false);
        return;
      }

      const localDraft = resolveLocalDraft(trimmed, intent);
      setDraft(localDraft);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          body: localDraft
            ? "HomeThread drafted this from your message. Review it before saving."
            : "Try a clearer event, chore, or grocery message and HomeThread can draft it."
        }
      ]);
      setIsThinking(false);
      return;
    }

    if (intent === "meal_plan") {
      await runMealSuggest(trimmed);
      return;
    }

    const result = await apiRequest<AssistantAssistResponse>("/ai/assist", {
      method: "POST",
      body: JSON.stringify({
        message: trimmed,
        intent,
        context: assistantContext
      })
    });

    if (result.data?.mode === "ai") {
      const assistantData = result.data;
      const nextDraft = assistantData.draft ?? resolveLocalDraft(trimmed, intent);
      setDraft(nextDraft);
      setAssistantNote(
        assistantData.provider
          ? `Suggestion from ${assistantData.provider}.`
          : "Suggestion from HomeThread."
      );
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          body: assistantData.message
        }
      ]);
      setIsThinking(false);
      return;
    }

    const localDraft = resolveLocalDraft(trimmed, intent);
    const unavailableMessage =
      result.data?.message ??
      result.error?.message ??
      "AI assistant is unavailable right now.";
    const summaryFallback = intent === "day_summary" ? buildLocalDaySummary(assistantContext) : null;

    setDraft(localDraft);
    setAssistantNote(
      localDraft
        ? "AI was unavailable. HomeThread made a local draft you can still save."
        : summaryFallback ?? unavailableMessage
    );
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        body: localDraft
          ? `${unavailableMessage} HomeThread created a local draft you can save.`
          : summaryFallback ?? unavailableMessage
      }
    ]);
    setIsThinking(false);
  }

  async function runMealSuggest(messageText: string) {
    const result = await apiRequest<AssistantMealSuggestResponse>("/ai/meal-suggest", {
      method: "POST",
      body: JSON.stringify({ message: messageText, dinnerCount: 5 })
    });

    const response = result.data;
    const unavailableMessage =
      response?.message ?? result.error?.message ?? "AI meal suggestions are unavailable right now.";

    if (response?.mode === "ai" && response.suggestions && response.suggestions.length > 0) {
      setMealSuggestions(response.suggestions);
      setAssistantNote(
        response.provider
          ? `Meal ideas from ${response.provider}.`
          : "Meal ideas from HomeThread."
      );
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          body: response.message
        }
      ]);
      setIsThinking(false);
      return;
    }

    setMealSuggestions(null);
    setAssistantNote(unavailableMessage);
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        body: unavailableMessage
      }
    ]);
    setIsThinking(false);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="Assistant"
        title="Ask HomeThread"
        subtitle="Draft ideas here. Nothing saves until you approve."
        icon="sparkles"
        badgeLabel={syncSource === "api" ? (assistantStatus?.configured ? "Cloud AI" : "Local draft") : "Preview"}
        badgeTone={syncSource === "api" ? (assistantStatus?.configured ? "mint" : "gold") : "neutral"}
        density="compact"
      />

      <View style={styles.surface}>
        <View style={styles.conversationContent}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.role === "user" ? styles.userBubble : styles.assistantBubble
              ]}
            >
              <Text style={message.role === "user" ? styles.userBubbleText : styles.assistantBubbleText}>
                {message.body}
              </Text>
            </View>
          ))}
          {isThinking ? (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.assistantBubbleText}>Thinking...</Text>
            </View>
          ) : null}

          {mealSuggestions && mealSuggestions.length > 0 ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Meal suggestions</Text>
              {mealSuggestions.map((suggestion) => {
                const key = mealSuggestionKey(suggestion);
                const added = savedMealKeys.includes(key);

                return (
                  <View key={key} style={styles.resultCard}>
                    <View style={styles.resultTop}>
                      <Pill label={dayLabels[suggestion.dayOfWeek] ?? "Day"} tone="primary" />
                      <Pill label={suggestion.mealType} tone="neutral" />
                    </View>
                    <Text style={styles.resultTitle}>{suggestion.title}</Text>
                    {suggestion.notes ? <Text style={styles.resultMeta}>{suggestion.notes}</Text> : null}
                    <PrimaryButton
                      label={added ? "Added to meals" : isSaving ? "Saving..." : "Add to meals"}
                      icon={added ? "checkmark" : "restaurant"}
                      tone={added ? "ghost" : "soft"}
                      onPress={() => {
                        if (added || isSaving) {
                          return;
                        }

                        void createMeal({
                          dayOfWeek: suggestion.dayOfWeek,
                          mealType: suggestion.mealType,
                          title: suggestion.title,
                          notes: suggestion.notes ?? undefined
                        }).then((outcome) => {
                          if (outcome.ok) {
                            setSavedMealKeys((current) => [...current, key]);
                            setDraftFeedback({ message: "Meal added to your plan.", tone: "success" });
                            return;
                          }

                          setDraftFeedback({
                            message: outcome.message ?? "Could not add that meal.",
                            tone: "error"
                          });
                        });
                      }}
                    />
                  </View>
                );
              })}
              {assistantNote ? <Text style={styles.resultNote}>{assistantNote}</Text> : null}
              {saveMessage ? <Text style={styles.saveStatus}>{saveMessage}</Text> : null}
            </View>
          ) : null}

          {draft ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Draft to review</Text>
              <View style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <Pill label="Suggested draft" tone="mint" icon="sparkles" />
                  <Pill
                    label={draft.kind}
                    tone={draft.kind === "event" ? "primary" : draft.kind === "chore" ? "gold" : "mint"}
                  />
                  <Text style={styles.confidence}>{Math.round(draft.confidence * 100)}%</Text>
                </View>
                <Text style={styles.resultTitle}>{draft.title}</Text>
                <Text style={styles.resultMeta}>{draft.detail}</Text>
                {assistantNote ? <Text style={styles.resultNote}>{assistantNote}</Text> : null}
                <ActionFeedback
                  message={draftFeedback?.message ?? ""}
                  tone={draftFeedback?.tone ?? "success"}
                  visible={Boolean(draftFeedback?.message)}
                />
                <Text style={styles.saveStatus}>
                  {isSaving
                    ? "Saving..."
                    : savedKind === "saved"
                      ? "Saved to your household."
                      : savedKind === "local"
                        ? "Saved on this device only. Pull to refresh when the connection is steady."
                        : saveMessage}
                </Text>
                <PrimaryButton
                  label={
                    isSaving
                      ? "Saving..."
                      : savedKind === "saved"
                        ? "Saved"
                        : savedKind === "local"
                          ? "Saved locally"
                          : "Save to HomeThread"
                  }
                  icon={
                    isSaving ? "sync" : savedKind === "saved" || savedKind === "local" ? "checkmark" : "add"
                  }
                  disabled={isSaving || savedKind !== null}
                  onPress={() => {
                    if (isSaving || savedKind !== null) return;
                    void commitDraft(draft).then((outcome) => {
                      if (outcome.kind === "failed") {
                        setDraftFeedback({ message: outcome.message, tone: "error" });
                        setSavedKind(null);
                        return;
                      }

                      setDraftFeedback({
                        message:
                          outcome.kind === "local"
                            ? "Saved on this device only. Pull to refresh when the connection is steady."
                            : "Saved to your household.",
                        tone: outcome.kind === "local" ? "info" : "success"
                      });
                      setSavedKind(outcome.kind === "local" ? "local" : "saved");
                    });
                  }}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPrompts((value) => !value)}
            style={styles.promptToggle}
          >
            <Text style={styles.promptToggleLabel}>{showPrompts ? "Hide suggestions" : "Try a suggestion"}</Text>
          </Pressable>
          {showPrompts ? (
            <View style={styles.promptRow}>
              {quickPrompts.map((entry) => (
                <Pressable
                  key={entry.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setPrompt(entry.text);
                    void runAssistant(entry.text, entry.intent);
                  }}
                >
                  <Pill label={entry.label} tone="neutral" />
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Assistant message"
            multiline
            onChangeText={setPrompt}
            placeholder="Paste family text or ask for help"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={prompt}
          />
          <PrimaryButton
            label={isThinking ? "Thinking..." : "Ask assistant"}
            icon="sparkles"
            disabled={!canSend}
            onPress={() => {
              if (!canSend) return;
              void runAssistant(prompt, "general");
            }}
          />
          {assistantStatusMessage ? <Text style={styles.statusNote}>{assistantStatusMessage}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function buildLocalDaySummary(context: AssistantContext) {
  const events = context.upcomingEvents ?? [];
  const chores = context.openChores ?? [];

  if (events.length === 0 && chores.length === 0) {
    return "Today looks clear so far. No upcoming events or open chores are showing.";
  }

  const eventText =
    events.length > 0
      ? `Upcoming: ${events
          .map((event) => `${event.title} at ${event.time}${event.location ? ` (${event.location})` : ""}`)
          .join("; ")}.`
      : "No events are coming up today.";

  const choreText =
    chores.length > 0
      ? `Open chores: ${chores.map((chore) => `${chore.title} (${chore.dueLabel})`).join("; ")}.`
      : "No open chores are showing right now.";

  return `${eventText} ${choreText}`.trim();
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden"
  },
  conversationContent: {
    gap: spacing.sm,
    padding: spacing.md
  },
  bubble: {
    borderRadius: radii.md,
    maxWidth: "92%",
    padding: spacing.md
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderWidth: 1
  },
  userBubbleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  assistantBubbleText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  resultBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  resultLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  resultCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  resultTop: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  resultTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  resultNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  confidence: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  saveStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  composer: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  promptToggle: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center"
  },
  promptToggleLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  promptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 72,
    padding: spacing.md,
    textAlignVertical: "top"
  },
  statusNote: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  }
});
