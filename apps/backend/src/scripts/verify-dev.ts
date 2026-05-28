import "dotenv/config";
import assert from "node:assert/strict";

import { buildApp } from "../app.js";
import { env } from "../env.js";

const headers = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const devFamilyId = "00000000-0000-4000-8000-000000000201";
const seededRecipeId = "00000000-0000-4000-8000-000000000701";

const app = buildApp();

async function injectJson(path: string, options: { method?: "GET" | "POST"; body?: Record<string, string> } = {}) {
  const response = await app.inject({
    method: options.method ?? "GET",
    url: `/api/v1${path}`,
    headers,
    ...(options.body ? { payload: options.body } : {})
  });
  const raw = response.body;
  let payload: unknown = raw;

  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  return {
    status: response.statusCode,
    payload
  };
}

try {
  const health = await injectJson("/health");
  const family = await injectJson(`/families/${devFamilyId}`);
  const events = await injectJson(`/families/${devFamilyId}/events`);
  const chores = await injectJson(`/families/${devFamilyId}/chores/today`);
  const lists = await injectJson(`/families/${devFamilyId}/lists`);
  const meals = await injectJson(`/families/${devFamilyId}/meals?weekStart=2026-05-25`);
  const recipes = await injectJson(`/families/${devFamilyId}/recipes`);

  const recipeIdForBridge =
    recipes.payload && isRecipesPayload(recipes.payload)
      ? (recipes.payload.recipes.find((recipe) => recipe.id === seededRecipeId)?.id ??
        recipes.payload.recipes[0]?.id)
      : undefined;

  const mealPlanItemIdForBridge =
    meals.payload && isMealsPayload(meals.payload) ? meals.payload.items[0]?.id : undefined;

  const toGroceryBody: Record<string, string> | null = recipeIdForBridge
    ? { recipeId: recipeIdForBridge }
    : mealPlanItemIdForBridge
      ? { mealPlanItemId: mealPlanItemIdForBridge }
      : null;

  const toGrocery = toGroceryBody
    ? await injectJson(`/families/${devFamilyId}/meals/to-grocery`, {
        method: "POST",
        body: toGroceryBody
      })
    : null;

  assert.equal(health.status, 200, "health route did not return 200");
  assert.ok(isHealthPayload(health.payload), "health payload shape was invalid");
  assert.equal(health.payload.ok, true, "health check did not report ok");
  assert.equal(health.payload.service, "homethread-backend", "unexpected health service name");

  assert.equal(family.status, 200, "family route did not return 200");
  assert.ok(isFamilyPayload(family.payload), "family payload shape was invalid");
  assert.ok(family.payload.members.length > 0, "family payload did not include members");

  assert.equal(events.status, 200, "events route did not return 200");
  assert.ok(isEventsPayload(events.payload), "events payload shape was invalid");
  for (const event of events.payload.events) {
    assert.ok(Array.isArray(event.memberIds), `event ${event.id} is missing memberIds`);
  }

  assert.equal(chores.status, 200, "chores route did not return 200");
  assert.ok(isChoresPayload(chores.payload), "chores payload shape was invalid");

  assert.equal(lists.status, 200, "lists route did not return 200");
  assert.ok(isListsPayload(lists.payload), "lists payload shape was invalid");
  const listsPayload = lists.payload;
  for (const list of listsPayload.lists) {
    assert.ok(Array.isArray(list.items), `list ${list.id} is missing items`);
  }

  assert.equal(meals.status, 200, "meals route did not return 200");
  assert.ok(isMealsPayload(meals.payload), "meals payload shape was invalid");

  assert.equal(recipes.status, 200, "recipes route did not return 200");
  assert.ok(isRecipesPayload(recipes.payload), "recipes payload shape was invalid");
  const recipesPayload = recipes.payload;

  assert.ok(toGroceryBody, "meal to-grocery check needs at least one recipe or meal plan item in dev data");
  assert.equal(toGrocery!.status, 201, "meal to-grocery route did not return 201");
  assert.ok(isToGroceryPayload(toGrocery!.payload), "meal to-grocery payload shape was invalid");
  const toGroceryPayload = toGrocery!.payload;
  assert.ok(
    toGroceryPayload.added.length + toGroceryPayload.skipped.length > 0,
    "meal to-grocery did not resolve any ingredients"
  );

  const destinationList = listsPayload.lists.find((list) => list.id === toGroceryPayload.listId);
  assert.ok(destinationList, "meal to-grocery returned a list id that was not found");
  assert.equal(destinationList.type, "grocery", "meal to-grocery must target a grocery list");

  console.log(
    JSON.stringify(
      {
        ok: true,
        verified: {
          familyName: family.payload.family.name,
          members: family.payload.members.length,
          events: events.payload.events.length,
          chores: chores.payload.chores.length,
          lists: listsPayload.lists.length,
          listItems: listsPayload.lists.reduce((count, list) => count + list.items.length, 0),
          meals: meals.payload.items.length,
          recipes: recipesPayload.recipes.length,
          groceryItemsAdded: toGroceryPayload.added.length,
          groceryItemsSkipped: toGroceryPayload.skipped.length
        }
      },
      null,
      2
    )
  );
} finally {
  await app.close();
}

function isHealthPayload(value: unknown): value is { ok: boolean; service: string } {
  return isRecord(value) && typeof value.ok === "boolean" && typeof value.service === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isFamilyPayload(value: unknown): value is {
  family: { id: string; name: string };
  members: Array<{ id: string; displayName: string }>;
} {
  if (!isRecord(value) || !isRecord(value.family) || !Array.isArray(value.members)) {
    return false;
  }

  return typeof value.family.id === "string" && typeof value.family.name === "string";
}

function isEventsPayload(value: unknown): value is {
  events: Array<{ id: string; title: string; memberIds: string[] }>;
} {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    return false;
  }

  return value.events.every(
    (event) =>
      isRecord(event) &&
      typeof event.id === "string" &&
      typeof event.title === "string" &&
      Array.isArray(event.memberIds)
  );
}

function isChoresPayload(value: unknown): value is {
  chores: Array<{ id: string; title: string }>;
} {
  if (!isRecord(value) || !Array.isArray(value.chores)) {
    return false;
  }

  return value.chores.every((chore) => isRecord(chore) && typeof chore.id === "string" && typeof chore.title === "string");
}

function isListsPayload(value: unknown): value is {
  lists: Array<{ id: string; title: string; type: string; items: Array<{ id: string; content: string }> }>;
} {
  if (!isRecord(value) || !Array.isArray(value.lists)) {
    return false;
  }

  return value.lists.every(
    (list) =>
      isRecord(list) &&
      typeof list.id === "string" &&
      typeof list.title === "string" &&
      typeof list.type === "string" &&
      Array.isArray(list.items) &&
      list.items.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.content === "string")
  );
}

function isRecipesPayload(value: unknown): value is {
  recipes: Array<{ id: string; title: string; ingredients: unknown[] }>;
} {
  if (!isRecord(value) || !Array.isArray(value.recipes)) {
    return false;
  }

  return value.recipes.every(
    (recipe) =>
      isRecord(recipe) &&
      typeof recipe.id === "string" &&
      typeof recipe.title === "string" &&
      Array.isArray(recipe.ingredients)
  );
}

function isToGroceryPayload(value: unknown): value is {
  listId: string;
  added: Array<{ id: string; content: string }>;
  skipped: string[];
} {
  if (!isRecord(value) || typeof value.listId !== "string" || !Array.isArray(value.added) || !Array.isArray(value.skipped)) {
    return false;
  }

  return (
    value.added.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.content === "string") &&
    value.skipped.every((content) => typeof content === "string")
  );
}

function isMealsPayload(value: unknown): value is {
  weekStart: string;
  items: Array<{ id: string; dayOfWeek: number; mealType: string; customTitle: string | null }>;
} {
  if (!isRecord(value) || typeof value.weekStart !== "string" || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.dayOfWeek === "number" &&
      typeof item.mealType === "string" &&
      ("customTitle" in item ? item.customTitle === null || typeof item.customTitle === "string" : true)
  );
}
