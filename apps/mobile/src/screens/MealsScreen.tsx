import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MealType, RecipeIngredient } from "../types";

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
  const plannedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === plannedRecipeId) ?? null,
    [plannedRecipeId, recipes]
  );
  const canSave = useMemo(() => Boolean(plannedRecipeId) || title.trim().length > 0, [plannedRecipeId, title]);
  const canSaveRecipe = useMemo(
    () => recipeTitle.trim().length > 0 && parseIngredientNames(recipeIngredients).length > 0,
    [recipeIngredients, recipeTitle]
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
          <Text style={styles.helperText}>Saved recipes show up here for quick grocery runs.</Text>
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

      {grouped.map((group) => (
        <View key={group.label}>
          <SectionTitle title={group.label} action={`${group.items.length} planned`} />
          {group.items.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Nothing planned yet.</Text>
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
    fontWeight: "700"
  }
});
