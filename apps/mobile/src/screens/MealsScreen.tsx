import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MealType, RecipeImportDraft, RecipeImportResponse, RecipeIngredient } from "../types";

const ingredientPreviewLimit = 3;

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

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

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
    saveMessage,
    syncSource,
    syncMessage
  } = useHomeThreadStore();
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
  const plannedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === plannedRecipeId) ?? null,
    [plannedRecipeId, recipes]
  );
  const canSave = useMemo(() => Boolean(plannedRecipeId) || title.trim().length > 0, [plannedRecipeId, title]);
  const canSaveRecipe = useMemo(
    () => recipeTitle.trim().length > 0 && parseIngredientNames(recipeIngredients).length > 0,
    [recipeIngredients, recipeTitle]
  );
  const importTimingPreview = useMemo(
    () => (importPreview ? formatRecipeTiming(importPreview) : null),
    [importPreview]
  );

  const grouped = useMemo(() => {
    return dayLabels.map((label, index) => ({
      label,
      items: meals.filter((meal) => meal.dayOfWeek === index)
    }));
  }, [meals]);

  async function savePlannedMeal() {
    const ok = await createMeal({
      dayOfWeek,
      mealType,
      title: plannedRecipe?.title ?? title,
      recipeId: plannedRecipeId
    });
    if (ok) {
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
        setImportNote(
          "URL import needs the API backend. HomeThread does not fetch recipe pages in this build — paste the recipe text instead."
        );
        setIsParsingImport(false);
        return;
      }

      const localRecipe = parseRecipeTextLocally(trimmed);
      setImportPreview(localRecipe);
      setImportNote(
        localRecipe
          ? "Prototype mode: simple local parse only. Review before saving."
          : "Add a title on the first line and ingredients on the following lines."
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

    const ok = await createRecipe({
      title: importPreview.title,
      ingredients: importPreview.ingredients,
      description: importPreview.description ?? null,
      instructions: importPreview.instructions,
      prepTimeMinutes: importPreview.prepTimeMinutes,
      cookTimeMinutes: importPreview.cookTimeMinutes,
      servings: importPreview.servings,
      ingredientNames: []
    });

    if (ok) {
      setImportInput("");
      setImportPreview(null);
      setImportNote(null);
    }
  }

  return (
    <View>
      <Text style={styles.title}>Meals</Text>
      <Text style={styles.subtitle}>Keep the week visible so dinner stops turning into a 5 p.m. surprise.</Text>

      <View style={styles.statusRow}>
        <Pill
          label={syncSource === "api" ? "Local backend connected" : "Prototype mode"}
          tone={syncSource === "api" ? "primary" : "neutral"}
        />
        <Text style={styles.syncNote}>
          Week of {mealWeekStart} - {syncMessage}
        </Text>
      </View>
      <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>

      {meals.length > 0 ? (
        <View style={styles.weekGroceryRow}>
          <PrimaryButton
            label={isSaving ? "Working..." : "Week to grocery"}
            icon="basket"
            onPress={() => {
              if (isSaving) return;
              void addWeekMealsToGrocery();
            }}
          />
        </View>
      ) : null}

      <Card>
        <Text style={styles.formTitle}>Import recipe</Text>
        <Text style={styles.helperText}>
          Paste recipe text for AI or simple parsing. URL mode keeps things honest here - it does not fetch recipe pages in this build.
        </Text>
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
            {importPreview.description ? (
              <Text style={styles.itemMeta}>{importPreview.description}</Text>
            ) : null}
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
                  <Text style={styles.itemMeta}>
                    +{importPreview.instructions.length - 3} more steps
                  </Text>
                ) : null}
              </>
            ) : null}
            <View style={styles.formActions}>
              <PrimaryButton
                label={isSaving ? "Saving..." : "Save imported recipe"}
                icon="checkmark"
                onPress={() => {
                  if (isSaving) return;
                  void saveImportedRecipe();
                }}
              />
            </View>
          </View>
        ) : null}
      </Card>

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
            onPress={() => {
              if (!canSaveRecipe || isSaving) return;
              void createRecipe({
                title: recipeTitle,
                ingredientNames: parseIngredientNames(recipeIngredients)
              }).then((ok) => {
                if (ok) {
                  setRecipeTitle("");
                  setRecipeIngredients("");
                }
              });
            }}
          />
        </View>
        {recipes.length > 0 ? (
          <View style={styles.recipeList}>
            {recipes.map((recipe) => (
              <View key={recipe.id} style={styles.recipeRow}>
                <View style={styles.fill}>
                  <Text style={styles.itemTitle}>{recipe.title}</Text>
                  <Text style={styles.itemMeta}>{formatRecipeIngredientPreview(recipe.ingredients)}</Text>
                </View>
                <PrimaryButton
                  label="To grocery"
                  icon="basket"
                  tone="dark"
                  onPress={() => {
                    if (isSaving) return;
                    void addMealIngredientsToGrocery({ recipeId: recipe.id });
                  }}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No saved recipes yet.</Text>
            <Text style={styles.emptyText}>
              Save one reliable family favorite first. It makes planning and grocery building feel much more useful.
            </Text>
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.formTitle}>Add meal</Text>
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
              if (!canSave || isSaving) return;
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
            onPress={() => {
              if (!canSave || isSaving) return;
              void savePlannedMeal();
            }}
          />
        </View>
      </Card>

      {meals.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No meals planned yet.</Text>
          <Text style={styles.emptyText}>
            Start with the busiest dinner night this week. A small plan is better than waiting for the perfect one.
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
                      label="To grocery"
                      icon="basket"
                      tone="dark"
                      onPress={() => {
                        if (isSaving) return;
                        void addMealIngredientsToGrocery({
                          mealPlanItemId: item.id,
                          recipeId: item.recipeId ?? undefined
                        });
                      }}
                    />
                    <PrimaryButton
                      label="Remove"
                      icon="trash"
                      tone="dark"
                      onPress={() => {
                        if (isSaving) return;
                        void removeMeal(item.id);
                      }}
                    />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      ))}
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md
  },
  syncNote: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.sm
  },
  weekGroceryRow: {
    marginTop: spacing.md
  },
  formTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
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
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
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
  recipeList: {
    gap: spacing.md,
    marginTop: spacing.lg
  },
  recipeRow: {
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
  emptyPanel: {
    marginTop: spacing.md
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.xs
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
    backgroundColor: colors.canvas,
    borderColor: colors.line,
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
    fontWeight: "900"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  }
});
