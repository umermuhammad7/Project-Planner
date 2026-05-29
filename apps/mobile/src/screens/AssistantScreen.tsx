import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import {
  AssistantAssistResponse,
  AssistantDraft,
  AssistantIntent,
  AssistantMealSuggestResponse,
  AssistantMealSuggestion
} from "../types";
import { parseFamilyText } from "../utils/textParser";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mealSuggestionKey(suggestion: AssistantMealSuggestion) {
  return `${suggestion.dayOfWeek}-${suggestion.mealType}-${suggestion.title}`;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
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
  }
];

export function AssistantScreen() {
  const { commitDraft, createMeal, isSaving, saveMessage, syncSource } = useHomeThreadStore();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [mealSuggestions, setMealSuggestions] = useState<AssistantMealSuggestion[] | null>(null);
  const [savedMealKeys, setSavedMealKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      body: "Tell HomeThread what the family needs. I can turn text into events, chores, lists, or meal and grocery help."
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [assistantNote, setAssistantNote] = useState<string | null>(null);

  const canSend = useMemo(() => prompt.trim().length > 0 && !isThinking, [isThinking, prompt]);

  async function runAssistant(messageText: string, intent?: AssistantIntent) {
    const trimmed = messageText.trim();
    if (!trimmed) {
      return;
    }

    setSaved(false);
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
              "Meal suggestions need API sync and a configured AI provider. In prototype mode, add meals manually on the Meals tab."
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
            ? "Assistant is in prototype mode. HomeThread used local parsing for this draft."
            : "Assistant is in prototype mode. Add a clear event, chore, or grocery item to get a local draft."
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
        intent
      })
    });

    if (result.data?.mode === "ai") {
      const assistantData = result.data;
      const nextDraft = assistantData.draft ?? resolveLocalDraft(trimmed, intent);
      setDraft(nextDraft);
      setAssistantNote(
        assistantData.provider
          ? `Answered by ${assistantData.provider} (not streamed).`
          : "Answered by AI (not streamed)."
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

    setDraft(localDraft);
    setAssistantNote(
      localDraft
        ? "AI was unavailable. HomeThread used local parsing for a draft you can save."
        : unavailableMessage
    );
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        body: localDraft
          ? `${unavailableMessage} HomeThread created a local draft you can save.`
          : unavailableMessage
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
          ? `Meal ideas from ${response.provider} (not streamed).`
          : "Meal ideas from AI (not streamed)."
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
    <View>
      <Text style={styles.title}>Assistant</Text>
      <Text style={styles.subtitle}>
        A simple assistant for family text, meals, groceries, and chores. Responses are not streamed in this build.
      </Text>

      <SectionTitle title="Quick prompts" />
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

      <SectionTitle title="Conversation" />
      <Card>
        <View style={styles.chatStack}>
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
        </View>
      </Card>

      {mealSuggestions && mealSuggestions.length > 0 ? (
        <>
          <SectionTitle title="Meal suggestions" />
          <View style={styles.suggestionStack}>
            {mealSuggestions.map((suggestion) => {
              const key = mealSuggestionKey(suggestion);
              const added = savedMealKeys.includes(key);

              return (
                <Card key={key}>
                  <View style={styles.suggestionTop}>
                    <Pill label={dayLabels[suggestion.dayOfWeek] ?? "Day"} tone="primary" />
                    <Pill label={suggestion.mealType} tone="neutral" />
                  </View>
                  <Text style={styles.draftTitle}>{suggestion.title}</Text>
                  {suggestion.notes ? <Text style={styles.meta}>{suggestion.notes}</Text> : null}
                  <View style={styles.saveRow}>
                    <PrimaryButton
                      label={added ? "Added to meals" : isSaving ? "Saving..." : "Add to meals"}
                      icon={added ? "checkmark" : "restaurant"}
                      onPress={() => {
                        if (added || isSaving) {
                          return;
                        }

                        void createMeal({
                          dayOfWeek: suggestion.dayOfWeek,
                          mealType: suggestion.mealType,
                          title: suggestion.title,
                          notes: suggestion.notes ?? undefined
                        }).then((ok) => {
                          if (ok) {
                            setSavedMealKeys((current) => [...current, key]);
                          }
                        });
                      }}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
          {assistantNote ? <Text style={styles.note}>{assistantNote}</Text> : null}
          <Text style={styles.saveStatus}>{saveMessage}</Text>
        </>
      ) : null}

      <SectionTitle title="Your message" />
      <Card>
        <TextInput
          accessibilityLabel="Assistant message"
          multiline
          onChangeText={setPrompt}
          placeholder="Type family text or ask for help"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={prompt}
        />
        <View style={styles.sendRow}>
          <PrimaryButton
            label={isThinking ? "Thinking..." : "Ask assistant"}
            icon="chatbubble-ellipses"
            onPress={() => {
              if (!canSend) return;
              void runAssistant(prompt, "general");
            }}
          />
        </View>
      </Card>

      {draft ? (
        <>
          <SectionTitle title="Draft to save" />
          <Card>
            <View style={styles.draftTop}>
              <Pill
                label={draft.kind}
                tone={draft.kind === "event" ? "primary" : draft.kind === "chore" ? "gold" : "mint"}
              />
              <Text style={styles.confidence}>{Math.round(draft.confidence * 100)}%</Text>
            </View>
            <Text style={styles.draftTitle}>{draft.title}</Text>
            <Text style={styles.meta}>{draft.detail}</Text>
            {assistantNote ? <Text style={styles.note}>{assistantNote}</Text> : null}
            <Text style={styles.saveStatus}>{isSaving ? "Saving..." : saveMessage}</Text>
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
        </>
      ) : null}
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
  promptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chatStack: {
    gap: spacing.sm
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
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 96,
    padding: spacing.md,
    textAlignVertical: "top"
  },
  sendRow: {
    marginTop: spacing.lg
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
  note: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.md
  },
  saveStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.md
  },
  saveRow: {
    marginTop: spacing.lg
  },
  suggestionStack: {
    gap: spacing.md
  },
  suggestionTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md
  }
});
