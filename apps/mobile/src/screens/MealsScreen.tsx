import { useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MealType, RecipeImportDraft, RecipeImportResponse, RecipeIngredient, SaveOutcome } from "../types";
import { feedbackToneForOutcome } from "../utils/saveOutcome";

const ingredientPreviewLimit = 3;
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

type MealsView = "plan" | "recipes";

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
  return parts.length > 0 ? parts.join(" - ") : null;
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

export function MealsScreen() {
  const {
    meals,
    recipes,
    mealWeekStart,
    createMeal,
    createRecipe,
    addMealIngredientsToGrocery,
    addWeekMealsToGrocery,
    removeMeal,
    isSaving,
    syncSource,
    syncMessage,
    isHydrating
  } = useHomeThreadStore();
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const plannedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === plannedRecipeId) ?? null,
    [plannedRecipeId, recipes]
  );
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

  function applyOutcome(outcome: SaveOutcome | null) {
    if (!outcome) {
      return false;
    }

    setSuccessMessage(null);
    setInfoMessage(null);
    setErrorMessage(null);
    const tone = feedbackToneForOutcome(outcome.kind);
    if (tone === "success") {
      Keyboard.dismiss();
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
    }
  }

  async function parseRecipeImport() {
    const trimmed = importInput.trim();
    if (!trimmed) {
      return;
    }

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
      setActiveView("recipes");
    }
  }

  return (
    <View>
      <Text style={styles.title}>This week's meals</Text>
      <Text style={styles.subtitle}>Keep the week visible so dinner stops becoming a five o'clock problem.</Text>

      <SyncStatusRow syncSource={syncSource} syncMessage={syncMessage} isHydrating={isHydrating} />
      <Text style={styles.weekNote}>Meal plan week starting {mealWeekStart}</Text>
      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      <Card>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Dinner coverage</Text>
            <Text style={styles.summaryValue}>{plannedDinnerCount}</Text>
            <Text style={styles.summaryMeta}>planned dinners this week</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Recipe shelf</Text>
            <Text style={styles.summaryValue}>{recipes.length}</Text>
            <Text style={styles.summaryMeta}>saved recipes ready to reuse</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.formTitle}>Meals and recipes</Text>
        <Text style={styles.helperText}>
          Keep planning and recipe storage separate so the screen stays calmer and easier to scan.
        </Text>
        <View style={styles.viewSwitch}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show meal plan"
            onPress={() => setActiveView("plan")}
            style={[styles.viewTab, activeView === "plan" ? styles.viewTabActive : null]}
          >
            <Text style={[styles.viewTabLabel, activeView === "plan" ? styles.viewTabLabelActive : null]}>
              Week plan
            </Text>
            <Text style={[styles.viewTabMeta, activeView === "plan" ? styles.viewTabMetaActive : null]}>
              {meals.length} planned
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show recipes"
            onPress={() => setActiveView("recipes")}
            style={[styles.viewTab, activeView === "recipes" ? styles.viewTabActive : null]}
          >
            <Text style={[styles.viewTabLabel, activeView === "recipes" ? styles.viewTabLabelActive : null]}>
              Recipes
            </Text>
            <Text style={[styles.viewTabMeta, activeView === "recipes" ? styles.viewTabMetaActive : null]}>
              {recipes.length} saved
            </Text>
          </Pressable>
        </View>
      </Card>

      {activeView === "plan" ? (
        <>
          {meals.length > 0 ? (
            <View style={styles.weekGroceryRow}>
              <PrimaryButton
                label={isSaving ? "Working..." : "Add week to grocery"}
                icon="basket"
                tone="soft"
                loading={isSaving}
                disabled={isSaving}
                onPress={() => {
                  if (isSaving) return;
                  void addWeekMealsToGrocery().then((outcome) => {
                    applyOutcome(outcome);
                  });
                }}
              />
            </View>
          ) : null}

          <Card>
            <Text style={styles.formTitle}>Plan a meal</Text>
            {recipes.length > 0 ? (
              <>
                <Text style={styles.pickerLabel}>From saved recipe (optional)</Text>
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
              </>
            ) : null}
            {plannedRecipe ? (
              <Text style={styles.selectedRecipeNote}>Planning: {plannedRecipe.title}</Text>
            ) : (
              <TextInput
                accessibilityLabel="Meal title"
                placeholder="e.g. Turkey tacos"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (isSaving) return;
                  void savePlannedMeal();
                }}
              />
            )}
            <Text style={styles.pickerLabel}>Day</Text>
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
            <Text style={styles.pickerLabel}>Meal type</Text>
            <View style={styles.pickerRow}>
              {mealTypes.map((type) => {
                const selected = type === mealType;
                return (
                  <Pressable key={type} accessibilityRole="button" onPress={() => setMealType(type)}>
                    <Pill label={type} tone={selected ? "mint" : "neutral"} />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.formActions}>
              <PrimaryButton
                label={isSaving ? "Saving..." : "Save meal"}
                icon="restaurant"
                loading={isSaving}
                disabled={isSaving}
                onPress={() => {
                  if (isSaving) return;
                  void savePlannedMeal();
                }}
              />
            </View>
            {recipes.length > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => setActiveView("recipes")} style={styles.secondaryLinkWrap}>
                <Text style={styles.secondaryLink}>Open recipes</Text>
              </Pressable>
            ) : null}
          </Card>

          {meals.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>No meals planned yet.</Text>
              <Text style={styles.emptyText}>
                Start with the busiest dinner night this week. A small plan beats waiting for the perfect one.
              </Text>
            </Card>
          ) : null}

          {grouped.map((group) => (
            <View key={group.label}>
              <SectionTitle title={group.label} action={`${group.items.length} planned`} />
              {group.items.length === 0 ? (
                <Card>
                  <Text style={styles.emptyText}>Nothing planned yet. Leave this day open if the family really keeps it flexible.</Text>
                </Card>
              ) : (
                <View style={styles.stack}>
                  {group.items.map((item) => (
                    <Card key={item.id}>
                      <Row align="flex-start">
                        <View style={styles.badgeWrap}>
                          <Pill label={item.mealType} tone="gold" />
                        </View>
                        <View style={styles.fill}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemMeta}>
                            {item.recipeId ? "Linked recipe" : item.notes ?? "Ready for the week"}
                          </Text>
                        </View>
                      </Row>
                      <View style={styles.mealActions}>
                        <PrimaryButton
                          label="Add to grocery"
                          icon="basket"
                          tone="soft"
                          loading={isSaving}
                          disabled={isSaving}
                          onPress={() => {
                            if (isSaving) return;
                            void addMealIngredientsToGrocery({
                              mealPlanItemId: item.id,
                              recipeId: item.recipeId ?? undefined
                            }).then((outcome) => {
                              applyOutcome(outcome);
                            });
                          }}
                        />
                        <PrimaryButton
                          label="Remove"
                          icon="trash"
                          tone="ghost"
                          disabled={isSaving}
                          onPress={() => {
                            if (isSaving) return;
                            void removeMeal(item.id).then((outcome) => {
                              applyOutcome(outcome);
                            });
                          }}
                        />
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.formTitle}>Recipe shelf</Text>
            <Text style={styles.helperText}>
              Save the meals your household repeats so planning and grocery building get faster each week.
            </Text>
            <View style={styles.recipeToolsRow}>
              <PrimaryButton
                label={showImportForm ? "Hide import" : "Import recipe"}
                icon="sparkles"
                tone={showImportForm ? "ghost" : "soft"}
                onPress={() => {
                  const next = !showImportForm;
                  setShowImportForm(next);
                  if (next) {
                    setShowManualRecipeForm(false);
                  }
                }}
              />
              <PrimaryButton
                label={showManualRecipeForm ? "Hide editor" : "Save manually"}
                icon="create"
                tone={showManualRecipeForm ? "ghost" : "soft"}
                onPress={() => {
                  const next = !showManualRecipeForm;
                  setShowManualRecipeForm(next);
                  if (next) {
                    setShowImportForm(false);
                  }
                }}
              />
            </View>
          </Card>

          {showImportForm ? (
            <Card>
              <Text style={styles.formTitle}>Import recipe</Text>
              <Text style={styles.helperText}>Paste recipe text to draft ingredients and steps.</Text>
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
                onChangeText={setImportInput}
                style={[styles.input, importSource === "text" ? styles.multilineInput : null]}
                multiline={importSource === "text"}
                autoCapitalize={importSource === "url" ? "none" : "sentences"}
              />
              <View style={styles.formActions}>
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
              </View>
              {importNote ? <Text style={styles.importNote}>{importNote}</Text> : null}
              {importPreview ? (
                <View style={styles.importPreview}>
                  <Text style={styles.itemTitle}>{importPreview.title}</Text>
                  {importPreview.description ? <Text style={styles.itemMeta}>{importPreview.description}</Text> : null}
                  {importTimingPreview ? <Text style={styles.itemMeta}>{importTimingPreview}</Text> : null}
                  <Text style={styles.pickerLabel}>Ingredients</Text>
                  {importPreview.ingredients.map((ingredient, index) => (
                    <Text key={`${ingredient.name}-${index}`} style={styles.importIngredient}>
                      {formatIngredientLabel(ingredient)}
                    </Text>
                  ))}
                  {importPreview.instructions && importPreview.instructions.length > 0 ? (
                    <>
                      <Text style={styles.pickerLabel}>Steps</Text>
                      {importPreview.instructions.slice(0, 3).map((step, index) => (
                        <Text key={`${step.text}-${index}`} style={styles.importIngredient}>
                          {step.step ?? index + 1}. {step.text}
                        </Text>
                      ))}
                      {importPreview.instructions.length > 3 ? (
                        <Text style={styles.itemMeta}>+{importPreview.instructions.length - 3} more steps</Text>
                      ) : null}
                    </>
                  ) : null}
                  <View style={styles.formActions}>
                    <PrimaryButton
                      label={isSaving ? "Saving..." : "Save imported recipe"}
                      icon="checkmark"
                      loading={isSaving}
                      disabled={isSaving}
                      onPress={() => {
                        if (isSaving) return;
                        void saveImportedRecipe();
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          ) : null}

          {showManualRecipeForm ? (
            <Card>
              <Text style={styles.formTitle}>Save recipe</Text>
              <TextInput
                accessibilityLabel="Recipe title"
                placeholder="e.g. Sheet-pan chicken fajitas"
                placeholderTextColor={colors.muted}
                value={recipeTitle}
                onChangeText={setRecipeTitle}
                style={styles.input}
              />
              <TextInput
                accessibilityLabel="Recipe ingredients"
                placeholder="Ingredients, one per line or comma-separated"
                placeholderTextColor={colors.muted}
                value={recipeIngredients}
                onChangeText={setRecipeIngredients}
                style={[styles.input, styles.multilineInput]}
                multiline
              />
              <View style={styles.formActions}>
                <PrimaryButton
                  label={isSaving ? "Saving..." : "Save recipe"}
                  icon="restaurant-outline"
                  loading={isSaving}
                  disabled={isSaving}
                  onPress={() => {
                    if (isSaving) return;
                    void createRecipe({
                      title: recipeTitle,
                      ingredientNames: parseIngredientNames(recipeIngredients)
                    }).then((outcome) => {
                      if (applyOutcome(outcome)) {
                        setRecipeTitle("");
                        setRecipeIngredients("");
                        setShowManualRecipeForm(false);
                        setActiveView("recipes");
                      }
                    });
                  }}
                />
              </View>
            </Card>
          ) : null}

          <SectionTitle title="Saved recipes" action={`${recipes.length} saved`} />
          {recipes.length > 0 ? (
            <View style={styles.recipeList}>
              {recipes.map((recipe) => (
                <Card key={recipe.id}>
                  <View style={styles.recipeCard}>
                    <View style={styles.fill}>
                      <Text style={styles.itemTitle}>{recipe.title}</Text>
                      <Text style={styles.itemMeta}>{formatRecipeIngredientPreview(recipe.ingredients)}</Text>
                    </View>
                    <PrimaryButton
                      label="Add to grocery"
                      icon="basket"
                      tone="soft"
                      loading={isSaving}
                      disabled={isSaving}
                      onPress={() => {
                        if (isSaving) return;
                        void addMealIngredientsToGrocery({ recipeId: recipe.id }).then((outcome) => {
                          applyOutcome(outcome);
                        });
                      }}
                    />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <Text style={styles.emptyTitle}>No saved recipes yet.</Text>
              <Text style={styles.emptyText}>
                Save one reliable family favorite first. It makes planning and grocery building feel much more useful.
              </Text>
            </Card>
          )}
        </>
      )}
    </View>
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
  weekNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  weekGroceryRow: {
    marginTop: spacing.md
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  summaryBlock: {
    flex: 1,
    gap: spacing.xs
  },
  summaryDivider: {
    backgroundColor: colors.line,
    width: 1
  },
  summaryLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  viewSwitch: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  viewTab: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  viewTabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.18)"
  },
  viewTabLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  viewTabLabelActive: {
    color: colors.primary
  },
  viewTabMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  viewTabMetaActive: {
    color: colors.primary
  },
  formTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md
  },
  multilineInput: {
    minHeight: 96,
    marginTop: spacing.md,
    textAlignVertical: "top"
  },
  pickerLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.md
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  formActions: {
    marginTop: spacing.lg
  },
  secondaryLinkWrap: {
    marginTop: spacing.md
  },
  secondaryLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  recipeToolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  recipeList: {
    gap: spacing.md
  },
  recipeCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.md
  },
  importNote: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: spacing.md
  },
  importPreview: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md
  },
  importIngredient: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  selectedRecipeNote: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: spacing.md,
    padding: spacing.md
  },
  stack: {
    gap: spacing.md
  },
  mealActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  badgeWrap: {
    paddingTop: 2
  },
  fill: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  }
});
