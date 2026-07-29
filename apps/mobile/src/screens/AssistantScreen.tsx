import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Pill, PrimaryButton } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import {
  ASSISTANT_WELCOME_MESSAGE,
  loadAssistantConversationFromStorage,
  saveAssistantConversationToStorage,
  StoredAssistantMessage
} from "../services/assistantConversationStorage";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";
import {
  AssistantAssistResponse,
  AssistantContext,
  AssistantDraft,
  AssistantIntent,
  AssistantMealSuggestResponse,
  AssistantMealSuggestion,
  RecipeImportDraft
} from "../types";
import { parseFamilyText } from "../utils/textParser";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";
import { safeArray, safeText } from "../utils/safeRender";

type IconName = keyof typeof Ionicons.glyphMap;

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatRecipeIngredientPreview(ingredients: RecipeImportDraft["ingredients"]) {
  return ingredients
    .slice(0, 6)
    .map((ingredient) => {
      const amount = [ingredient.amount, ingredient.unit].filter(Boolean).join(" ");
      return amount ? `${amount} ${ingredient.name}` : ingredient.name;
    })
    .join(", ");
}

function mealSuggestionKey(suggestion: AssistantMealSuggestion) {
  return `${suggestion.dayOfWeek}-${suggestion.mealType}-${suggestion.title}`;
}

function destinationLabel(kind: AssistantDraft["kind"]) {
  if (kind === "event") return "Plan";
  if (kind === "chore") return "Chores";
  if (kind === "list") return "Lists";
  return "HomeThread";
}

type ChatMessage = StoredAssistantMessage;

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

function looksLikeImportedText(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.includes("\n") || trimmed.length > 80) {
    return true;
  }

  return /\b\d{1,2}[:.]\d{2}\s?(am|pm)?\b/i.test(trimmed) && /\b(moved|rescheduled|cancelled|canceled|reminder|pickup|drop off|dropoff)\b/i.test(trimmed);
}

const recipeRequestPattern = /\brecipe\b|\bhow (?:do i|to|do you) (?:make|cook|bake)\b/i;

function looksLikeRecipeRequest(message: string) {
  return recipeRequestPattern.test(message.trim());
}

function resolveIntentForInput(message: string): AssistantIntent {
  if (looksLikeRecipeRequest(message)) {
    return "recipe";
  }

  return looksLikeImportedText(message) ? "import_text" : "general";
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

const quickPrompts: Array<{ label: string; hint: string; icon: IconName; intent: AssistantIntent; text: string }> = [
  {
    label: "Import a family text",
    hint: "Paste a message and HomeThread drafts it for you",
    icon: "clipboard-outline",
    intent: "import_text",
    text: "Soccer moved to 5:30 Friday at Field 2"
  },
  {
    label: "Suggest a meal plan",
    hint: "Get simple dinner ideas for the week",
    icon: "restaurant-outline",
    intent: "meal_plan",
    text: "Suggest a simple dinner plan for our family this week."
  },
  {
    label: "Make a grocery list",
    hint: "Turn what you need into a shared list",
    icon: "cart-outline",
    intent: "grocery_list",
    text: "Add milk, eggs, bread, and bananas to the grocery list."
  },
  {
    label: "Turn into a chore",
    hint: "Assign a task to someone in the household",
    icon: "checkbox-outline",
    intent: "chores",
    text: "Remind Jules to unload the dishwasher tonight."
  },
  {
    label: "Get a recipe",
    hint: "Saves to Meals with a one-tap grocery add",
    icon: "book-outline",
    intent: "recipe",
    text: "Give me a recipe for brownies."
  },
  {
    label: "What's on today?",
    hint: "A quick summary of plans and open chores",
    icon: "today-outline",
    intent: "day_summary",
    text: "What's on today?"
  }
];

const NEAR_BOTTOM_THRESHOLD = 120;
// Matches App.tsx's outer ScrollView chrome: content paddingVertical (spacing.lg) above the
// screen, the fixed tab bar's reserved paddingBottom (168) below it, plus this screen's own
// compact header + gap. Keeping this in sync with that chrome is what lets the panel actually
// fill the visible viewport instead of guessing a height ratio that leaves dead space.
const CHROME_ABOVE_PANEL = spacing.lg + 108;
const CHROME_BELOW_PANEL = 168;

export function AssistantScreen({ onBack }: { onBack?: () => void } = {}) {
  const {
    commitDraft,
    createMeal,
    createRecipe,
    addMealIngredientsToGrocery,
    familyId,
    familyName,
    members,
    events,
    chores,
    syncSource
  } = useHomeThreadStore();
  const isSavingBoard = useHomeThreadStore(isHomeThreadSavingScope("board"));
  const isSavingMeals = useHomeThreadStore(isHomeThreadSavingScope("meals"));
  const { height: windowHeight } = useWindowDimensions();
  const conversationScrollRef = useRef<ScrollView>(null);
  const pinnedToBottomRef = useRef(true);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeImportDraft | null>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [groceryAdded, setGroceryAdded] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [isAddingGroceries, setIsAddingGroceries] = useState(false);
  const [mealSuggestions, setMealSuggestions] = useState<AssistantMealSuggestion[] | null>(null);
  const [savedMealKeys, setSavedMealKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([ASSISTANT_WELCOME_MESSAGE]);
  const [conversationReady, setConversationReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [savedKind, setSavedKind] = useState<"saved" | "local" | null>(null);
  const [draftFeedback, setDraftFeedback] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null
  );
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [assistantStatusMessage, setAssistantStatusMessage] = useState<string | null>(null);
  const hasUserMessages = useMemo(() => messages.some((message) => message.role === "user"), [messages]);
  const panelHeight = Math.min(
    Math.max(windowHeight - CHROME_ABOVE_PANEL - CHROME_BELOW_PANEL, 380),
    820
  );

  const scrollConversationToBottom = useCallback((animated = true) => {
    conversationScrollRef.current?.scrollToEnd({ animated });
  }, []);

  const handleConversationScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    pinnedToBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  const canSend = useMemo(() => prompt.trim().length > 0 && !isThinking, [isThinking, prompt]);
  const assistantContext = useMemo<AssistantContext>(() => {
    const eventRows = safeArray(events);
    const memberRows = safeArray(members);
    const choreRows = safeArray(chores);

    const upcomingEvents = [...eventRows]
      .sort(compareEventsByStartAt)
      .filter((event) => getEventUrgency(event)?.label !== "Past")
      .slice(0, 5)
      .map((event) => {
        const assignedTo = Array.isArray(event.assignedTo) ? event.assignedTo : [];
        const assignedMemberNames = assignedTo
          .map((id) => memberRows.find((member) => member.id === id)?.name)
          .filter((name): name is string => Boolean(name));

        return {
          title: safeText(event.title, "Untitled plan"),
          time: safeText(event.time, "Time TBD"),
          dateLabel: safeText(event.dateLabel, "Date TBD"),
          location: event.location ?? null,
          assignedTo: assignedMemberNames
        };
      });

    const openChores = choreRows
      .filter((chore) => !chore.completed)
      .slice(0, 5)
      .map((chore) => ({
        title: safeText(chore.title, "Chore"),
        dueLabel: safeText(chore.dueLabel, "Today")
      }));

    return {
      familyName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      today: new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      members: memberRows.map((member) => safeText(member.name, "Family member")),
      upcomingEvents,
      openChores
    };
  }, [chores, events, familyName, members]);

  useEffect(() => {
    let cancelled = false;

    if (syncSource !== "api") {
      setAssistantStatus(null);
      setAssistantStatusMessage("Sign in to your household to get full answers. This device can still draft simple text.");
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
        setAssistantStatusMessage(null);
        return;
      }

      setAssistantStatusMessage("Full answers aren't set up yet. HomeThread can still draft simple text for you.");
    })();

    return () => {
      cancelled = true;
    };
  }, [syncSource]);

  useEffect(() => {
    let cancelled = false;
    setConversationReady(false);

    void (async () => {
      const stored = await loadAssistantConversationFromStorage(familyId);
      if (cancelled) {
        return;
      }

      setMessages(stored);
      pinnedToBottomRef.current = true;
      setConversationReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId]);

  useEffect(() => {
    if (!conversationReady) {
      return;
    }

    void saveAssistantConversationToStorage(familyId, messages);
  }, [conversationReady, familyId, messages]);

  useEffect(() => {
    if (!conversationReady || !pinnedToBottomRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      scrollConversationToBottom(true);
    }, 80);
    return () => clearTimeout(timer);
  }, [conversationReady, draft, isThinking, mealSuggestions, messages, scrollConversationToBottom]);

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
    setRecipeDraft(null);
    setSavedRecipeId(null);
    setGroceryAdded(false);
    setMealSuggestions(null);
    setSavedMealKeys([]);
    pinnedToBottomRef.current = true;
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

      if (intent === "recipe") {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            body: "Recipes need a signed-in household. For now, add recipes on the Meals tab."
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
      if (assistantData.recipe) {
        setRecipeDraft(assistantData.recipe);
      } else {
        const nextDraft = assistantData.draft ?? resolveLocalDraft(trimmed, intent);
        setDraft(nextDraft);
      }
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

  async function handleSaveRecipe() {
    if (!recipeDraft || isSavingRecipe || savedRecipeId) {
      return;
    }

    setIsSavingRecipe(true);
    const outcome = await createRecipe({
      title: recipeDraft.title,
      description: recipeDraft.description,
      ingredients: recipeDraft.ingredients,
      instructions: recipeDraft.instructions,
      prepTimeMinutes: recipeDraft.prepTimeMinutes,
      cookTimeMinutes: recipeDraft.cookTimeMinutes,
      servings: recipeDraft.servings
    });
    setIsSavingRecipe(false);

    if (outcome.kind === "failed") {
      setDraftFeedback({ message: outcome.message, tone: "error" });
      return;
    }

    const saved = useHomeThreadStore
      .getState()
      .recipes.filter((recipe) => recipe.title === recipeDraft.title)
      .at(-1);
    setSavedRecipeId(saved?.id ?? null);
    setDraftFeedback({
      message: outcome.message || "Added to Meals → Saved Recipes.",
      tone: outcome.kind === "local" ? "info" : "success"
    });
  }

  async function handleAddRecipeGroceries() {
    if (!savedRecipeId || isAddingGroceries || groceryAdded) {
      return;
    }

    setIsAddingGroceries(true);
    const outcome = await addMealIngredientsToGrocery({ recipeId: savedRecipeId });
    setIsAddingGroceries(false);

    if (outcome.kind === "failed") {
      setDraftFeedback({ message: outcome.message, tone: "error" });
      return;
    }

    setGroceryAdded(true);
    setDraftFeedback({ message: outcome.message, tone: outcome.kind === "local" ? "info" : "success" });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="Assistant"
        title="Assistant"
        subtitle={hasUserMessages ? undefined : "Ask a question or add something quickly."}
        density="compact"
        actionLabel={onBack ? "Back" : undefined}
        onActionPress={onBack}
      />

      <View style={[styles.surface, { height: panelHeight }]}>
        <ScrollView
          ref={conversationScrollRef}
          style={styles.conversationScroll}
          contentContainerStyle={styles.conversationContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleConversationScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
        >
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

          {!hasUserMessages ? (
            <View style={styles.suggestionBlock}>
              <Text style={styles.suggestionGreeting}>
                {greetingForNow()}
                {familyName ? `, ${familyName}` : ""}
              </Text>
              {quickPrompts.map((entry) => (
                <Pressable
                  key={entry.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setPrompt(entry.text);
                    void runAssistant(entry.text, entry.intent);
                  }}
                  style={({ pressed }) => [styles.suggestionCard, pressed && styles.suggestionCardPressed]}
                >
                  <View style={styles.suggestionIcon}>
                    <Ionicons color={colors.primary} name={entry.icon} size={18} />
                  </View>
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionLabel}>{entry.label}</Text>
                    <Text numberOfLines={1} style={styles.suggestionHint}>{entry.hint}</Text>
                  </View>
                  <Ionicons color={colors.muted} name="chevron-forward" size={18} />
                </Pressable>
              ))}
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
                      label={added ? "Added to meals" : isSavingMeals ? "Saving..." : "Add to meals"}
                      icon={added ? "checkmark" : "restaurant"}
                      tone={added ? "mint" : "primary"}
                      onPress={() => {
                        if (added || isSavingMeals) {
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
            </View>
          ) : null}

          {recipeDraft ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Recipe to review</Text>
              <View style={[styles.resultCard, savedRecipeId && styles.resultCardSaved]}>
                <View style={styles.resultTop}>
                  {savedRecipeId ? (
                    <Pill label="Saved" tone="mint" icon="checkmark-circle" />
                  ) : (
                    <Pill label="Draft — not saved yet" tone="mint" icon="sparkles" />
                  )}
                  <Pill label="Meals" tone="primary" />
                </View>
                <Text style={styles.resultTitle}>{recipeDraft.title}</Text>
                <Text style={styles.resultMeta}>{formatRecipeIngredientPreview(recipeDraft.ingredients)}</Text>
                {assistantNote ? <Text style={styles.resultNote}>{assistantNote}</Text> : null}
                <ActionFeedback
                  message={draftFeedback?.message ?? ""}
                  tone={draftFeedback?.tone ?? "success"}
                  visible={Boolean(draftFeedback?.message)}
                />
                <PrimaryButton
                  label={
                    isSavingRecipe
                      ? "Saving..."
                      : savedRecipeId
                        ? "Added to Saved Recipes"
                        : "Save to Meals"
                  }
                  icon={isSavingRecipe ? "sync" : savedRecipeId ? "checkmark" : "restaurant"}
                  tone={savedRecipeId ? "mint" : "primary"}
                  disabled={isSavingRecipe || Boolean(savedRecipeId)}
                  onPress={() => void handleSaveRecipe()}
                />
                {savedRecipeId ? (
                  <PrimaryButton
                    label={
                      isAddingGroceries
                        ? "Adding..."
                        : groceryAdded
                          ? "Added to groceries"
                          : "Add ingredients to groceries"
                    }
                    icon={isAddingGroceries ? "sync" : groceryAdded ? "checkmark" : "cart"}
                    tone={groceryAdded ? "mint" : "soft"}
                    disabled={isAddingGroceries || groceryAdded}
                    onPress={() => void handleAddRecipeGroceries()}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {draft ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Draft to review</Text>
              <View style={[styles.resultCard, savedKind && styles.resultCardSaved]}>
                <View style={styles.resultTop}>
                  {savedKind ? (
                    <Pill label="Saved" tone="mint" icon="checkmark-circle" />
                  ) : (
                    <Pill label="Draft — not saved yet" tone="mint" icon="sparkles" />
                  )}
                  <Pill
                    label={destinationLabel(draft.kind)}
                    tone={draft.kind === "event" ? "primary" : draft.kind === "chore" ? "gold" : "mint"}
                  />
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
                  {isSavingBoard
                    ? "Saving..."
                    : savedKind === "saved"
                      ? `Added to ${destinationLabel(draft.kind)}.`
                      : savedKind === "local"
                        ? "Saved on this device only. Pull to refresh when the connection is steady."
                        : ""}
                </Text>
                <PrimaryButton
                  label={
                    isSavingBoard
                      ? "Saving..."
                      : savedKind === "saved"
                        ? `Added to ${destinationLabel(draft.kind)}`
                        : savedKind === "local"
                          ? "Saved locally"
                          : `Add to ${destinationLabel(draft.kind)}`
                  }
                  icon={
                    isSavingBoard ? "sync" : savedKind === "saved" || savedKind === "local" ? "checkmark" : "add"
                  }
                  tone={savedKind ? "mint" : "primary"}
                  disabled={isSavingBoard || savedKind !== null}
                  onPress={() => {
                    if (isSavingBoard || savedKind !== null) return;
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
                            : outcome.message || `Added to ${destinationLabel(draft.kind)}.`,
                        tone: outcome.kind === "local" ? "info" : "success"
                      });
                      setSavedKind(outcome.kind === "local" ? "local" : "saved");
                    });
                  }}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.composer}>
            <View style={styles.composerRow}>
              <TextInput
                accessibilityLabel="Assistant message"
                multiline
                onChangeText={setPrompt}
                placeholder="Ask HomeThread or paste a family text..."
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={prompt}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                disabled={!canSend}
                onPress={() => {
                  if (!canSend) return;
                  void runAssistant(prompt, resolveIntentForInput(prompt));
                }}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!canSend || isThinking) && styles.sendButtonDisabled,
                  pressed && canSend && styles.sendButtonPressed
                ]}
              >
                <Ionicons color="#FFFFFF" name={isThinking ? "hourglass-outline" : "send"} size={18} />
              </Pressable>
            </View>
            {assistantStatusMessage ? <Text style={styles.statusNote}>{assistantStatusMessage}</Text> : null}
          </View>
        </KeyboardAvoidingView>
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
    gap: 0
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "column",
    overflow: "hidden"
  },
  conversationScroll: {
    flex: 1
  },
  conversationContent: {
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: "flex-end",
    padding: spacing.md
  },
  bubble: {
    borderRadius: radii.lg,
    maxWidth: "88%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderColor: colors.line,
    borderWidth: 1
  },
  userBubbleText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21
  },
  assistantBubbleText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21
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
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12
  },
  resultCardSaved: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.2)",
    borderLeftColor: colors.mint
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
  saveStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  suggestionGreeting: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  suggestionCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  suggestionCardPressed: {
    backgroundColor: colors.canvas,
    opacity: 0.9
  },
  suggestionIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  suggestionCopy: {
    flex: 1,
    gap: 2
  },
  suggestionLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  suggestionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16
  },
  composer: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderTopWidth: 1,
    flexShrink: 0,
    gap: spacing.xs,
    padding: spacing.sm
  },
  composerRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: "center"
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonPressed: {
    backgroundColor: colors.primaryPressed
  },
  statusNote: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  }
});
