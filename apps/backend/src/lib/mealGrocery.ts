import type { RecipeIngredientInput } from "@homethread/shared";
import { and, asc, eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { listItems, lists, mealPlanItems, mealPlans, recipes } from "../db/schema.js";

type IngredientLine = {
  name: string;
  amount?: string | null;
  unit?: string | null;
};

export function formatIngredientContent(ingredient: IngredientLine) {
  const amount = ingredient.amount?.trim();
  const unit = ingredient.unit?.trim();
  const name = ingredient.name.trim();
  const prefix = [amount, unit].filter(Boolean).join(" ");
  return prefix ? `${prefix} ${name}`.trim() : name;
}

export async function resolveMealGroceryIngredients(input: {
  familyId: string;
  recipeId?: string;
  mealPlanItemId?: string;
}) {
  if (input.recipeId) {
    return loadRecipeIngredients(input.familyId, input.recipeId);
  }

  if (!input.mealPlanItemId) {
    return { error: "MISSING_TARGET" as const };
  }

  const mealItem = await db.query.mealPlanItems.findFirst({
    where: eq(mealPlanItems.id, input.mealPlanItemId)
  });

  if (!mealItem) {
    return { error: "MEAL_NOT_FOUND" as const };
  }

  const plan = await db.query.mealPlans.findFirst({
    where: eq(mealPlans.id, mealItem.planId)
  });

  if (!plan || plan.familyId !== input.familyId) {
    return { error: "MEAL_NOT_FOUND" as const };
  }

  if (mealItem.recipeId) {
    return loadRecipeIngredients(input.familyId, mealItem.recipeId);
  }

  if (mealItem.customTitle?.trim()) {
    return {
      ingredients: [{ name: mealItem.customTitle.trim() }]
    };
  }

  return { error: "MEAL_HAS_NO_INGREDIENTS" as const };
}

async function loadRecipeIngredients(familyId: string, recipeId: string) {
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, recipeId)
  });

  if (!recipe || recipe.familyId !== familyId) {
    return { error: "RECIPE_NOT_FOUND" as const };
  }

  const ingredients = normalizeIngredients(recipe.ingredients);
  if (ingredients.length === 0) {
    return { error: "RECIPE_HAS_NO_INGREDIENTS" as const };
  }

  return { ingredients, recipeTitle: recipe.title };
}

function normalizeIngredients(value: unknown): IngredientLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ingredients: IngredientLine[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !("name" in entry)) {
      continue;
    }

    const record = entry as RecipeIngredientInput;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      continue;
    }

    ingredients.push({
      name,
      amount: typeof record.amount === "string" ? record.amount : null,
      unit: typeof record.unit === "string" ? record.unit : null
    });
  }

  return ingredients;
}

export async function findFamilyGroceryListId(familyId: string, preferredListId?: string) {
  if (preferredListId) {
    const preferred = await db.query.lists.findFirst({
      where: and(eq(lists.familyId, familyId), eq(lists.id, preferredListId))
    });
    if (preferred?.type === "grocery") {
      return preferred.id;
    }
  }

  const grocery = await db.query.lists.findFirst({
    where: and(eq(lists.familyId, familyId), eq(lists.type, "grocery"))
  });

  return grocery?.id ?? null;
}

export async function addIngredientsToGroceryList(input: {
  familyId: string;
  listId: string;
  ingredients: IngredientLine[];
  createdBy: string;
}) {
  const existingItems = await db.query.listItems.findMany({
    where: eq(listItems.listId, input.listId)
  });
  const existingContents = new Set(existingItems.map((item) => item.content.trim().toLowerCase()));

  const added: Array<{ id: string; content: string }> = [];
  const skipped: string[] = [];
  let sortOrder = existingItems.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), 0);

  for (const ingredient of input.ingredients) {
    const content = formatIngredientContent(ingredient);
    const normalized = content.toLowerCase();
    if (existingContents.has(normalized)) {
      skipped.push(content);
      continue;
    }

    sortOrder += 1;
    const [item] = await db
      .insert(listItems)
      .values({
        listId: input.listId,
        content,
        category: null,
        quantity: null,
        sortOrder,
        createdBy: input.createdBy
      })
      .returning();

    existingContents.add(normalized);
    added.push({ id: item.id, content: item.content });
  }

  return { added, skipped };
}

export async function resolveWeekMealGroceryIngredients(familyId: string, weekStart: string) {
  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.familyId, familyId), eq(mealPlans.weekStart, weekStart))
  });

  if (!plan) {
    return { ingredients: [], mealsProcessed: 0 };
  }

  const items = await db.query.mealPlanItems.findMany({
    where: eq(mealPlanItems.planId, plan.id),
    orderBy: [asc(mealPlanItems.dayOfWeek), asc(mealPlanItems.mealType)]
  });

  const ingredients: IngredientLine[] = [];
  const seenInBatch = new Set<string>();

  for (const item of items) {
    const resolved = await resolveMealGroceryIngredients({
      familyId,
      mealPlanItemId: item.id
    });

    if ("error" in resolved) {
      continue;
    }

    for (const ingredient of resolved.ingredients) {
      const normalized = formatIngredientContent(ingredient).toLowerCase();
      if (seenInBatch.has(normalized)) {
        continue;
      }
      seenInBatch.add(normalized);
      ingredients.push(ingredient);
    }
  }

  return { ingredients, mealsProcessed: items.length };
}
