import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { FieldError, Pill, PrimaryButton } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { apiRequest } from "../services/api";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";
import { MealType, Recipe, RecipeImportDraft, RecipeImportResponse, RecipeIngredient, SaveOutcome } from "../types";
import { feedbackToneForOutcome } from "../utils/saveOutcome";

const ingredientPreviewLimit = 3;
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const mealTypeEmoji: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "🥪",
  dinner: "🍽️",
  snack: "🍪"
};

function formatIngredientLabel(ingredient: RecipeIngredient) {
  const amount = ingredient.amount?.trim();
  const unit = ingredient.unit?.trim();
  const name = ingredient.name.trim();
  const prefix = [amount, unit].filter(Boolean).join(" ");
  return prefix ? `${prefix} ${name}`.trim() : name;
}

function formatRecipeIngredientPreview(ingredients: RecipeIngredient[]) {
  if (ingredients.length === 0) {
    return "No ingredients listed";
  }

  const preview = ingredients.slice(0, ingredientPreviewLimit).map(formatIngredientLabel);
  const remaining = ingredients.length - preview.length;
  if (remaining > 0) {
    return `${preview.join(", ")} +${remaining} more`;
  }

  return preview.join(", ");
}

function parseIngredientNames(raw: string) {
  return raw
    .split(/[\n,]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatRecipeTiming(draft: RecipeImportDraft) {
  const parts: string[] = [];
  if (draft.prepTimeMinutes != null) {
    parts.push(`Prep ${draft.prepTimeMinutes} min`);
  }
  if (draft.cookTimeMinutes != null) {
    parts.push(`Cook ${draft.cookTimeMinutes} min`);
  }
  if (draft.servings != null) {
    parts.push(`Serves ${draft.servings}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function parseRecipeTextLocally(text: string): RecipeImportDraft | null {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const ingredients: RecipeIngredient[] = [];

  for (const line of lines.slice(1)) {
    if (/^instructions?\b[:\s]/iu.test(line)) {
      break;
    }

    if (/^ingredients?\b[:\s]/iu.test(line)) {
      continue;
    }

    for (const part of line.split(",")) {
      const name = part.trim();
      if (name) {
        ingredients.push({ name });
      }
    }
  }

  if (ingredients.length === 0) {
    return null;
  }

  return {
    title: lines[0],
    ingredients
  };
}

type MealsView = "plan" | "recipes";

export function MealsScreen({ onBack }: { onBack?: () => void } = {}) {
  const {
    meals,
    recipes,
    mealWeekStart,
    createMeal,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    addMealIngredientsToGrocery,
    addWeekMealsToGrocery,
    removeMeal,
    syncSource,
    syncMessage,
    isHydrating
  } = useHomeThreadStore();
  const isSavingMeals = useHomeThreadStore(isHomeThreadSavingScope("meals"));
  const { scrollToTop } = useScrollAssist();

  const [title, setTitle] = useState("");
  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [plannedRecipeId, setPlannedRecipeId] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<"text" | "url">("text");
  const [importInput, setImportInput] = useState("");
  const [importPreview, setImportPreview] = useState<RecipeImportDraft | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [activeView, setActiveView] = useState<MealsView>("plan");
  const [showImportForm, setShowImportForm] = useState(false);
  const [showManualRecipeForm, setShowManualRecipeForm] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [showMealForm, setShowMealForm] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [pendingDeleteRecipeId, setPendingDeleteRecipeId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mealTitleError, setMealTitleError] = useState<string | null>(null);
  const [recipeTitleError, setRecipeTitleError] = useState<string | null>(null);
  const [importInputError, setImportInputError] = useState<string | null>(null);

  const plannedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === plannedRecipeId) ?? null,
    [plannedRecipeId, recipes]
  );

  const beginRecipeEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeTitle(recipe.title);
    setRecipeIngredients(recipe.ingredients.map((ingredient) => ingredient.name).join("\n"));
    setRecipeTitleError(null);
    setExpandedRecipeId(null);
    setPendingDeleteRecipeId(null);
    setShowManualRecipeForm(true);
  };

  function resetRecipeForm() {
    setEditingRecipeId(null);
    setRecipeTitle("");
    setRecipeIngredients("");
    setRecipeTitleError(null);
    setShowManualRecipeForm(false);
  }

  function closeManualRecipeForm() {
    if (isSavingMeals) return;
    resetRecipeForm();
  }

  function closeImportForm() {
    if (isSavingMeals || isParsingImport) return;
    setShowImportForm(false);
    setImportInput("");
    setImportPreview(null);
    setImportNote(null);
    setImportInputError(null);
  }

  const importTimingPreview = useMemo(
    () => (importPreview ? formatRecipeTiming(importPreview) : null),
    [importPreview]
  );
  const grouped = useMemo(
    () =>
      dayLabels.map((label, index) => ({
        label,
        items: meals.filter((meal) => meal.dayOfWeek === index)
      })),
    [meals]
  );
  const plannedDinnerCount = useMemo(
    () => meals.filter((meal) => meal.mealType === "dinner").length,
    [meals]
  );
  const daysCovered = useMemo(() => grouped.filter((group) => group.items.length > 0).length, [grouped]);
  const nextMeal = useMemo(() => {
    for (const group of grouped) {
      if (group.items.length > 0) {
        return { day: group.label, item: group.items[0] };
      }
    }
    return null;
  }, [grouped]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  function openMealForm() {
    setTitle("");
    setPlannedRecipeId(null);
    setMealTitleError(null);
    setShowMealForm(true);
  }

  function closeMealForm() {
    if (isSavingMeals) return;
    setShowMealForm(false);
  }

  function applyOutcome(outcome: SaveOutcome | null) {
    if (!outcome) {
      return false;
    }

    setSuccessMessage(null);
    setInfoMessage(null);
    setErrorMessage(null);
    const tone = feedbackToneForOutcome(outcome.kind);
    if (tone === "success") {
      scrollToTop();
      setSuccessMessage(outcome.message);
    } else if (tone === "info") {
      scrollToTop();
      setInfoMessage(outcome.message);
    } else {
      scrollToTop();
      setErrorMessage(outcome.message);
    }

    return outcome.ok;
  }

  useEffect(() => {
    if (!successMessage && !infoMessage && !errorMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setInfoMessage(null);
      setErrorMessage(null);
    }, errorMessage ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [errorMessage, infoMessage, successMessage]);

  async function savePlannedMeal() {
    if (!plannedRecipe && !title.trim()) {
      setMealTitleError("Meal title is required.");
      setErrorMessage(null);
      return;
    }

    setMealTitleError(null);
    const outcome = await createMeal({
      dayOfWeek,
      mealType,
      title: plannedRecipe?.title ?? title,
      recipeId: plannedRecipeId
    });
    const accepted = applyOutcome(outcome);
    if (accepted) {
      setTitle("");
      setPlannedRecipeId(null);
      setShowMealForm(false);
    }
  }

  async function parseRecipeImport() {
    const trimmed = importInput.trim();
    if (!trimmed) {
      setImportInputError("Paste recipe text or a URL first.");
      return;
    }

    setImportInputError(null);
    setIsParsingImport(true);
    setImportPreview(null);
    setImportNote(null);

    if (syncSource !== "api") {
      if (importSource === "url") {
        setImportNote("Paste the recipe text instead. URL import is not available on this device yet.");
        setIsParsingImport(false);
        return;
      }

      const localRecipe = parseRecipeTextLocally(trimmed);
      setImportPreview(localRecipe);
      setImportNote(
        localRecipe
          ? "Review this recipe draft before saving."
          : "Add a title first, then the ingredients."
      );
      setIsParsingImport(false);
      return;
    }

    const payload =
      importSource === "url"
        ? { source: "url" as const, url: trimmed }
        : { source: "text" as const, text: trimmed };

    const result = await apiRequest<RecipeImportResponse>("/ai/recipe-import", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const response = result.data;
    setImportNote(
      response?.message ??
        result.error?.message ??
        "Recipe import is unavailable right now."
    );
    setImportPreview(response?.recipe ?? null);
    setIsParsingImport(false);
  }

  async function saveImportedRecipe() {
    if (!importPreview) {
      return;
    }

    const outcome = await createRecipe({
      title: importPreview.title,
      ingredients: importPreview.ingredients,
      description: importPreview.description ?? null,
      instructions: importPreview.instructions,
      prepTimeMinutes: importPreview.prepTimeMinutes,
      cookTimeMinutes: importPreview.cookTimeMinutes,
      servings: importPreview.servings,
      ingredientNames: []
    });

    if (applyOutcome(outcome)) {
      setImportInput("");
      setImportPreview(null);
      setImportNote(null);
      setShowImportForm(false);
    }
  }

  async function handleDeleteRecipe(recipeId: string) {
    if (isSavingMeals) return;
    const outcome = await deleteRecipe(recipeId);
    setPendingDeleteRecipeId(null);
    if (applyOutcome(outcome) && editingRecipeId === recipeId) {
      resetRecipeForm();
    }
    setExpandedRecipeId(null);
  }

  const weekMetaText =
    meals.length === 0
      ? `Week of ${mealWeekStart} · nothing planned yet`
      : `${daysCovered}/7 days covered · ${plannedDinnerCount} dinner${plannedDinnerCount === 1 ? "" : "s"} planned`;

  return (
    <View style={styles.screen}>
      <View style={styles.plannerCard}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => [styles.backHit, pressed && styles.backHitPressed]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.ink} />
            </Pressable>
          ) : null}
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Meals</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {weekMetaText}
            </Text>
            {meals.length > 0 ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round((daysCovered / 7) * 100)}%` as `${number}%` }
                  ]}
                />
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plan a meal"
            onPress={() => {
              setActiveView("plan");
              openMealForm();
            }}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Plan meal</Text>
          </Pressable>
        </View>

        {nextMeal ? (
          <View style={styles.nextBar}>
            <View style={styles.nextAccent} />
            <View style={styles.nextIcon}>
              <Text style={styles.nextIconGlyph}>{mealTypeEmoji[nextMeal.item.mealType]}</Text>
            </View>
            <View style={styles.nextCopy}>
              <Text style={styles.nextLabel}>Next up · {nextMeal.day}</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>
                {nextMeal.item.title}
              </Text>
              <Text style={styles.nextSchedule} numberOfLines={1}>
                {nextMeal.item.mealType}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <SyncStatusRow syncSource={syncSource} syncMessage={syncMessage} isHydrating={isHydrating} />
      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      <View style={styles.viewSwitch}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show week plan"
          onPress={() => setActiveView("plan")}
          style={[styles.viewTab, activeView === "plan" && styles.viewTabActive]}
        >
          <Text style={styles.viewTabGlyph}>📅</Text>
          <Text style={[styles.viewTabLabel, activeView === "plan" && styles.viewTabLabelActive]}>
            Week plan
          </Text>
          <View style={[styles.viewTabBadge, activeView === "plan" && styles.viewTabBadgeActive]}>
            <Text style={[styles.viewTabBadgeText, activeView === "plan" && styles.viewTabBadgeTextActive]}>
              {meals.length}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show recipes"
          onPress={() => setActiveView("recipes")}
          style={[styles.viewTab, activeView === "recipes" && styles.viewTabActive]}
        >
          <Text style={styles.viewTabGlyph}>📖</Text>
          <Text style={[styles.viewTabLabel, activeView === "recipes" && styles.viewTabLabelActive]}>
            Recipes
          </Text>
          <View style={[styles.viewTabBadge, activeView === "recipes" && styles.viewTabBadgeActive]}>
            <Text style={[styles.viewTabBadgeText, activeView === "recipes" && styles.viewTabBadgeTextActive]}>
              {recipes.length}
            </Text>
          </View>
        </Pressable>
      </View>

      {activeView === "plan" ? (
        <>
          {meals.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>No meals planned yet.</Text>
              <Text style={styles.emptyText}>
                Tap "Plan meal" to start with tonight's dinner — or a favorite from your recipe shelf.
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.label} style={styles.agendaArea}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{group.label}</Text>
                  <View style={styles.sectionHeaderRule} />
                  {group.items.length > 0 ? (
                    <Text style={styles.sectionCount}>{group.items.length}</Text>
                  ) : null}
                </View>

                {group.items.length === 0 ? (
                  <Text style={styles.dayEmpty}>Open</Text>
                ) : (
                  <View style={styles.mealList}>
                    {group.items.map((item) => {
                      const isExpanded = expandedMealId === item.id;
                      return (
                        <View key={item.id} style={[styles.mealRow, isExpanded && styles.mealRowExpanded]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: isExpanded }}
                            accessibilityLabel={`${item.title}. ${isExpanded ? "Hide" : "Show"} actions`}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setExpandedMealId((current) => (current === item.id ? null : item.id));
                            }}
                            style={({ pressed }) => [styles.mealMain, pressed && styles.mealMainPressed]}
                          >
                            <View style={styles.mealTypeIcon}>
                              <Text style={styles.mealTypeGlyph}>{mealTypeEmoji[item.mealType]}</Text>
                            </View>
                            <View style={styles.mealCopy}>
                              <Text style={styles.mealTitle}>{item.title}</Text>
                              <Text style={styles.mealMeta}>
                                {item.mealType}
                                {item.recipeId ? " · linked recipe" : item.notes ? ` · ${item.notes}` : ""}
                              </Text>
                            </View>
                            <Ionicons
                              name={isExpanded ? "chevron-up" : "chevron-forward"}
                              size={14}
                              color={colors.tertiary}
                            />
                          </Pressable>

                          {isExpanded ? (
                            <View style={styles.mealExpanded}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Add "${item.title}" ingredients to grocery list`}
                                disabled={isSavingMeals}
                                onPress={() => {
                                  if (isSavingMeals) return;
                                  void addMealIngredientsToGrocery({
                                    mealPlanItemId: item.id,
                                    recipeId: item.recipeId ?? undefined
                                  }).then((outcome) => {
                                    applyOutcome(outcome);
                                  });
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                              >
                                <Ionicons name="basket-outline" size={14} color={colors.primary} />
                                <Text style={styles.actionLinkText}>Add to grocery</Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove "${item.title}"`}
                                disabled={isSavingMeals}
                                onPress={() => {
                                  if (isSavingMeals) return;
                                  void removeMeal(item.id).then((outcome) => {
                                    applyOutcome(outcome);
                                    setExpandedMealId(null);
                                  });
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                              >
                                <Text style={[styles.actionLinkText, styles.deleteText]}>Remove</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          )}

          {meals.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add whole week to grocery list"
              disabled={isSavingMeals}
              onPress={() => {
                if (isSavingMeals) return;
                void addWeekMealsToGrocery().then((outcome) => {
                  applyOutcome(outcome);
                });
              }}
              style={({ pressed }) => [styles.weekGroceryButton, pressed && styles.weekGroceryButtonPressed]}
            >
              <Ionicons name="basket-outline" size={16} color={colors.primary} />
              <Text style={styles.weekGroceryButtonText}>
                {isSavingMeals ? "Working…" : "Add week to grocery list"}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved recipes</Text>
            <View style={styles.sectionHeaderRule} />
            {recipes.length > 0 ? <Text style={styles.sectionCount}>{recipes.length}</Text> : null}
          </View>

          {recipes.length > 0 ? (
            <View style={styles.mealList}>
              {recipes.map((recipe) => {
                const isExpanded = expandedRecipeId === recipe.id;
                return (
                  <View key={recipe.id} style={[styles.mealRow, isExpanded && styles.mealRowExpanded]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                      accessibilityLabel={`${recipe.title}. ${isExpanded ? "Hide" : "Show"} actions`}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedRecipeId((current) => (current === recipe.id ? null : recipe.id));
                        setPendingDeleteRecipeId(null);
                      }}
                      style={({ pressed }) => [styles.mealMain, pressed && styles.mealMainPressed]}
                    >
                      <View style={styles.mealTypeIcon}>
                        <Text style={styles.mealTypeGlyph}>📖</Text>
                      </View>
                      <View style={styles.mealCopy}>
                        <Text style={styles.mealTitle}>{recipe.title}</Text>
                        <Text style={styles.mealMeta} numberOfLines={1}>
                          {formatRecipeIngredientPreview(recipe.ingredients)}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-forward"}
                        size={14}
                        color={colors.tertiary}
                      />
                    </Pressable>

                    {isExpanded ? (
                      <View style={styles.mealExpanded}>
                        {pendingDeleteRecipeId === recipe.id ? (
                          <View style={styles.deleteConfirm}>
                            <Text style={styles.deleteConfirmText}>Delete "{recipe.title}"?</Text>
                            <View style={styles.deleteConfirmActions}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Keep recipe"
                                onPress={() => setPendingDeleteRecipeId(null)}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                              >
                                <Text style={styles.actionLinkText}>Keep</Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Confirm delete "${recipe.title}"`}
                                disabled={isSavingMeals}
                                onPress={() => void handleDeleteRecipe(recipe.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                              >
                                <Text style={[styles.actionLinkText, styles.deleteText]}>
                                  {isSavingMeals ? "Deleting…" : "Delete"}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.expandedActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Edit "${recipe.title}"`}
                              disabled={isSavingMeals}
                              onPress={() => beginRecipeEdit(recipe)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Text style={styles.actionLinkText}>Edit</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Add "${recipe.title}" ingredients to grocery list`}
                              disabled={isSavingMeals}
                              onPress={() => {
                                if (isSavingMeals) return;
                                void addMealIngredientsToGrocery({ recipeId: recipe.id }).then((outcome) => {
                                  applyOutcome(outcome);
                                });
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Ionicons name="basket-outline" size={14} color={colors.primary} />
                              <Text style={styles.actionLinkText}>Add to grocery</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Delete "${recipe.title}"`}
                              disabled={isSavingMeals}
                              onPress={() => setPendingDeleteRecipeId(recipe.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Text style={[styles.actionLinkText, styles.deleteText]}>Delete</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>No saved recipes yet.</Text>
              <Text style={styles.emptyText}>Save a family favorite to speed up planning.</Text>
            </View>
          )}

          <View style={styles.recipeToolsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import recipe"
              onPress={() => setShowImportForm(true)}
              style={({ pressed }) => [styles.toolButton, pressed && styles.toolButtonPressed]}
            >
              <Text style={styles.toolButtonGlyph}>✨</Text>
              <Text style={styles.toolButtonText}>Import recipe</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save recipe manually"
              onPress={() => setShowManualRecipeForm(true)}
              style={({ pressed }) => [styles.toolButton, pressed && styles.toolButtonPressed]}
            >
              <Text style={styles.toolButtonGlyph}>✍️</Text>
              <Text style={styles.toolButtonText}>Save manually</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Plan meal modal */}
      <Modal visible={showMealForm} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeMealForm}>
        <SafeAreaView style={styles.composeSafe}>
          <KeyboardAvoidingView style={styles.composeRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composeStage}>
              <View style={styles.composePanel}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Text style={styles.composeHeaderGlyph}>🍽️</Text>
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>Plan a meal</Text>
                    <Text style={styles.composeHint}>Pick a day, a meal type, and a title or saved recipe.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingMeals}
                    onPress={closeMealForm}
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
                  {recipes.length > 0 ? (
                    <View style={styles.formField}>
                      <Text style={styles.fieldLabel}>From saved recipe · optional</Text>
                      <View style={styles.pickerRow}>
                        <Pressable accessibilityRole="button" onPress={() => setPlannedRecipeId(null)}>
                          <Pill label="Custom title" tone={plannedRecipeId === null ? "primary" : "neutral"} />
                        </Pressable>
                        {recipes.map((recipe) => {
                          const selected = plannedRecipeId === recipe.id;
                          return (
                            <Pressable
                              key={recipe.id}
                              accessibilityRole="button"
                              onPress={() => {
                                setPlannedRecipeId(recipe.id);
                                setTitle("");
                              }}
                            >
                              <Pill label={recipe.title} tone={selected ? "mint" : "neutral"} />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>What's on the menu?</Text>
                    {plannedRecipe ? (
                      <Text style={styles.selectedRecipeNote}>Planning: {plannedRecipe.title}</Text>
                    ) : (
                      <>
                        <TextInput
                          accessibilityLabel="Meal title"
                          placeholder="e.g. Turkey tacos"
                          placeholderTextColor={colors.muted}
                          value={title}
                          onChangeText={(value) => {
                            setTitle(value);
                            if (mealTitleError) setMealTitleError(null);
                          }}
                          style={[styles.input, mealTitleError ? styles.inputInvalid : null]}
                          returnKeyType="done"
                          onSubmitEditing={() => {
                            if (isSavingMeals) return;
                            void savePlannedMeal();
                          }}
                        />
                        <FieldError message={mealTitleError} />
                      </>
                    )}
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Day</Text>
                    <View style={styles.pickerRow}>
                      {dayLabels.map((label, index) => {
                        const selected = index === dayOfWeek;
                        return (
                          <Pressable key={label} accessibilityRole="button" onPress={() => setDayOfWeek(index)}>
                            <Pill label={label} tone={selected ? "primary" : "neutral"} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Meal type</Text>
                    <View style={styles.pickerRow}>
                      {mealTypes.map((type) => {
                        const selected = type === mealType;
                        return (
                          <Pressable key={type} accessibilityRole="button" onPress={() => setMealType(type)}>
                            <Pill
                              label={`${mealTypeEmoji[type]} ${type}`}
                              tone={selected ? "mint" : "neutral"}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.composeFooter}>
                  <PrimaryButton
                    label={isSavingMeals ? "Saving..." : "Save meal"}
                    icon="restaurant"
                    loading={isSavingMeals}
                    disabled={isSavingMeals}
                    onPress={() => {
                      if (isSavingMeals) return;
                      void savePlannedMeal();
                    }}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Import recipe modal */}
      <Modal visible={showImportForm} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeImportForm}>
        <SafeAreaView style={styles.composeSafe}>
          <KeyboardAvoidingView style={styles.composeRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composeStage}>
              <View style={styles.composePanel}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Text style={styles.composeHeaderGlyph}>✨</Text>
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>Import recipe</Text>
                    <Text style={styles.composeHint}>Paste recipe text or a link and we'll do the rest.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingMeals || isParsingImport}
                    onPress={closeImportForm}
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
                    <View style={styles.pickerRow}>
                      <Pressable accessibilityRole="button" onPress={() => setImportSource("text")}>
                        <Pill label="Paste text" tone={importSource === "text" ? "primary" : "neutral"} />
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => setImportSource("url")}>
                        <Pill label="URL" tone={importSource === "url" ? "primary" : "neutral"} />
                      </Pressable>
                    </View>
                    <TextInput
                      accessibilityLabel={importSource === "text" ? "Recipe text to import" : "Recipe URL"}
                      placeholder={
                        importSource === "text"
                          ? "Title on first line, then ingredients (one per line)"
                          : "https://example.com/recipe"
                      }
                      placeholderTextColor={colors.muted}
                      value={importInput}
                      onChangeText={(value) => {
                        setImportInput(value);
                        if (importInputError) setImportInputError(null);
                      }}
                      style={[
                        styles.input,
                        importSource === "text" ? styles.multilineInput : null,
                        importInputError ? styles.inputInvalid : null
                      ]}
                      multiline={importSource === "text"}
                      autoCapitalize={importSource === "url" ? "none" : "sentences"}
                    />
                    <FieldError message={importInputError} />
                  </View>

                  <PrimaryButton
                    label={isParsingImport ? "Parsing..." : "Parse recipe"}
                    icon="sparkles"
                    tone="soft"
                    loading={isParsingImport}
                    disabled={isParsingImport}
                    onPress={() => {
                      if (isParsingImport) return;
                      void parseRecipeImport();
                    }}
                  />

                  {importNote ? <Text style={styles.importNote}>{importNote}</Text> : null}
                  {importPreview ? (
                    <View style={styles.importPreview}>
                      <Text style={styles.mealTitle}>{importPreview.title}</Text>
                      {importPreview.description ? (
                        <Text style={styles.mealMeta}>{importPreview.description}</Text>
                      ) : null}
                      {importTimingPreview ? <Text style={styles.mealMeta}>{importTimingPreview}</Text> : null}
                      <Text style={styles.fieldLabel}>Ingredients</Text>
                      {importPreview.ingredients.map((ingredient, index) => (
                        <Text key={`${ingredient.name}-${index}`} style={styles.importIngredient}>
                          {formatIngredientLabel(ingredient)}
                        </Text>
                      ))}
                      {importPreview.instructions && importPreview.instructions.length > 0 ? (
                        <>
                          <Text style={styles.fieldLabel}>Steps</Text>
                          {importPreview.instructions.slice(0, 3).map((step, index) => (
                            <Text key={`${step.text}-${index}`} style={styles.importIngredient}>
                              {step.step ?? index + 1}. {step.text}
                            </Text>
                          ))}
                          {importPreview.instructions.length > 3 ? (
                            <Text style={styles.mealMeta}>+{importPreview.instructions.length - 3} more steps</Text>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.composeFooter}>
                  <PrimaryButton
                    label={isSavingMeals ? "Saving..." : "Save imported recipe"}
                    icon="checkmark"
                    loading={isSavingMeals}
                    disabled={isSavingMeals || !importPreview}
                    onPress={() => {
                      if (isSavingMeals) return;
                      void saveImportedRecipe();
                    }}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Manual recipe modal */}
      <Modal
        visible={showManualRecipeForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeManualRecipeForm}
      >
        <SafeAreaView style={styles.composeSafe}>
          <KeyboardAvoidingView style={styles.composeRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composeStage}>
              <View style={styles.composePanel}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Text style={styles.composeHeaderGlyph}>✍️</Text>
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>{editingRecipeId ? "Edit recipe" : "Save recipe"}</Text>
                    <Text style={styles.composeHint}>
                      {editingRecipeId ? "Update the details and save." : "Give it a title and list the ingredients."}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingMeals}
                    onPress={closeManualRecipeForm}
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
                    <Text style={styles.fieldLabel}>Recipe title</Text>
                    <TextInput
                      accessibilityLabel="Recipe title"
                      placeholder="e.g. Sheet-pan chicken fajitas"
                      placeholderTextColor={colors.muted}
                      value={recipeTitle}
                      onChangeText={(value) => {
                        setRecipeTitle(value);
                        if (recipeTitleError) setRecipeTitleError(null);
                      }}
                      style={[styles.input, recipeTitleError ? styles.inputInvalid : null]}
                    />
                    <FieldError message={recipeTitleError} />
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Ingredients</Text>
                    <TextInput
                      accessibilityLabel="Recipe ingredients"
                      placeholder="One per line or comma-separated"
                      placeholderTextColor={colors.muted}
                      value={recipeIngredients}
                      onChangeText={setRecipeIngredients}
                      style={[styles.input, styles.multilineInput]}
                      multiline
                    />
                  </View>
                </ScrollView>

                <View style={styles.composeFooter}>
                  <PrimaryButton
                    label={isSavingMeals ? "Saving..." : editingRecipeId ? "Update recipe" : "Save recipe"}
                    icon="restaurant-outline"
                    loading={isSavingMeals}
                    disabled={isSavingMeals}
                    onPress={() => {
                      if (isSavingMeals) return;
                      if (!recipeTitle.trim()) {
                        setRecipeTitleError("Recipe title is required.");
                        return;
                      }
                      setRecipeTitleError(null);
                      const payload = {
                        title: recipeTitle,
                        ingredientNames: parseIngredientNames(recipeIngredients)
                      };
                      const savePromise = editingRecipeId
                        ? updateRecipe({ recipeId: editingRecipeId, ...payload })
                        : createRecipe(payload);
                      void savePromise.then((outcome) => {
                        if (applyOutcome(outcome)) {
                          resetRecipeForm();
                          setActiveView("recipes");
                        }
                      });
                    }}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    paddingBottom: 96
  },
  // Header card
  plannerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadow.card
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 10,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  backHit: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    marginLeft: -6,
    width: 32
  },
  backHitPressed: {
    opacity: 0.6
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 26
  },
  headerMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 2
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    marginTop: 8,
    overflow: "hidden",
    width: "100%"
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 4
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 3,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  // Next up bar
  nextBar: {
    alignItems: "flex-start",
    backgroundColor: colors.goldSoft,
    borderTopColor: "rgba(153,106,0,0.14)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  nextAccent: {
    backgroundColor: "#996A00",
    borderRadius: 2,
    marginTop: 2,
    minHeight: 36,
    width: 3
  },
  nextIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    height: 24,
    justifyContent: "center",
    marginTop: 1,
    width: 24
  },
  nextIconGlyph: {
    fontSize: 12,
    lineHeight: 15
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2
  },
  nextLabel: {
    color: "#996A00",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  nextTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 19,
    marginTop: 2
  },
  nextSchedule: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 3,
    opacity: 0.78,
    textTransform: "capitalize"
  },
  // View switch
  viewSwitch: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs
  },
  viewTab: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  viewTabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  viewTabGlyph: {
    fontSize: 15
  },
  viewTabLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  viewTabLabelActive: {
    color: colors.primary
  },
  viewTabBadge: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radii.pill,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 5
  },
  viewTabBadgeActive: {
    backgroundColor: colors.primary
  },
  viewTabBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  viewTabBadgeTextActive: {
    color: "#FFFFFF"
  },
  // Agenda layout
  agendaArea: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
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
  dayEmpty: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 2
  },
  mealList: {
    gap: 8
  },
  // Row (meal / recipe)
  mealRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  mealRowExpanded: {
    borderColor: colors.lineStrong
  },
  mealMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  mealMainPressed: {
    backgroundColor: "rgba(247,243,238,0.72)"
  },
  mealTypeIcon: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  mealTypeGlyph: {
    fontSize: 16
  },
  mealCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  mealTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 19
  },
  mealMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 15,
    textTransform: "capitalize"
  },
  mealExpanded: {
    backgroundColor: colors.canvas,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 8
  },
  expandedActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  actionLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 28,
    paddingVertical: 2
  },
  actionLinkPressed: {
    opacity: 0.65
  },
  actionLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  deleteText: {
    color: colors.coral
  },
  deleteConfirm: {
    gap: spacing.xs
  },
  deleteConfirmText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  deleteConfirmActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  // Week grocery button
  weekGroceryButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10
  },
  weekGroceryButtonPressed: {
    backgroundColor: "#F5EFE7"
  },
  weekGroceryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  // Recipe tools row
  recipeToolsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  toolButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 12
  },
  toolButtonPressed: {
    backgroundColor: "#F5EFE7"
  },
  toolButtonGlyph: {
    fontSize: 15
  },
  toolButtonText: {
    color: colors.ink,
    fontSize: 13,
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
  // Form modal (shared across the three compose flows)
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
    flex: 1,
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
    flex: 1
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
  // Form fields
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
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inputInvalid: {
    borderColor: colors.coral
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  selectedRecipeNote: {
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    padding: spacing.md
  },
  importNote: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18
  },
  importPreview: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  importIngredient: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700"
  }
});
