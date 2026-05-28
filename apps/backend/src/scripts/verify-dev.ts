import "dotenv/config";
import assert from "node:assert/strict";

import { buildApp } from "../app.js";
import { env } from "../env.js";

const headers = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const app = buildApp();

async function injectJson(path: string) {
  const response = await app.inject({
    method: "GET",
    url: `/api/v1${path}`,
    headers
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
  const family = await injectJson("/families/00000000-0000-4000-8000-000000000201");
  const events = await injectJson("/families/00000000-0000-4000-8000-000000000201/events");
  const chores = await injectJson("/families/00000000-0000-4000-8000-000000000201/chores/today");
  const lists = await injectJson("/families/00000000-0000-4000-8000-000000000201/lists");
  const meals = await injectJson("/families/00000000-0000-4000-8000-000000000201/meals?weekStart=2026-05-25");

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
  for (const list of lists.payload.lists) {
    assert.ok(Array.isArray(list.items), `list ${list.id} is missing items`);
  }

  assert.equal(meals.status, 200, "meals route did not return 200");
  assert.ok(isMealsPayload(meals.payload), "meals payload shape was invalid");

  console.log(
    JSON.stringify(
      {
        ok: true,
        verified: {
          familyName: family.payload.family.name,
          members: family.payload.members.length,
          events: events.payload.events.length,
          chores: chores.payload.chores.length,
          lists: lists.payload.lists.length,
          listItems: lists.payload.lists.reduce((count, list) => count + list.items.length, 0),
          meals: meals.payload.items.length
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
