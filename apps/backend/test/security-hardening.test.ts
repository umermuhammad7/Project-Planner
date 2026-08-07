import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

describe("security hardening", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("disables dev-token auth unless it is explicitly enabled outside tests", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDevAuthEnabled = process.env.DEV_AUTH_ENABLED;
    try {
      process.env.NODE_ENV = "development";
      delete process.env.DEV_AUTH_ENABLED;

      vi.resetModules();
      const { getAuthStatus } = await import("../src/env.js");

      expect(getAuthStatus()).toMatchObject({
        devTokenAllowed: false,
        supabaseConfigured: true,
        mode: "supabase"
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousDevAuthEnabled === undefined) {
        delete process.env.DEV_AUTH_ENABLED;
      } else {
        process.env.DEV_AUTH_ENABLED = previousDevAuthEnabled;
      }
    }
  });

  it("rejects cross-family member ids on events", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Security Family A" }
    });
    expect(familyAResponse.statusCode).toBe(201);
    const familyAId = familyAResponse.json().family.id as string;

    const memberAResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Child A",
        color: "#3157D5",
        role: "child",
        isVirtual: true
      }
    });
    expect(memberAResponse.statusCode).toBe(201);
    const memberAId = memberAResponse.json().member.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Security Family B" }
    });
    expect(familyBResponse.statusCode).toBe(201);
    const familyBId = familyBResponse.json().family.id as string;

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/events`,
      headers: authHeaders,
      payload: {
        title: "Soccer practice",
        startAt: "2026-06-15T16:00:00.000Z",
        endAt: "2026-06-15T17:00:00.000Z",
        allDay: false,
        memberIds: [memberAId]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "One or more assigned members do not belong to this family.",
      code: "EVENT_MEMBER_INVALID"
    });
    await app.close();
  });

  it("rejects cross-family chore completions and duplicate reward claims", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Chore Family A" }
    });
    expect(familyAResponse.statusCode).toBe(201);
    const familyAId = familyAResponse.json().family.id as string;

    const memberAResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Child A",
        color: "#3157D5",
        role: "child",
        isVirtual: true
      }
    });
    expect(memberAResponse.statusCode).toBe(201);
    const memberAId = memberAResponse.json().member.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Chore Family B" }
    });
    expect(familyBResponse.statusCode).toBe(201);
    const familyBId = familyBResponse.json().family.id as string;

    const memberBResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Child B",
        color: "#2DAA84",
        role: "child",
        isVirtual: true
      }
    });
    expect(memberBResponse.statusCode).toBe(201);
    const memberBId = memberBResponse.json().member.id as string;

    const choreResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/chores`,
      headers: authHeaders,
      payload: {
        title: "Unload dishwasher",
        starsValue: 2,
        assignedTo: memberBId,
        isActive: true
      }
    });
    expect(choreResponse.statusCode).toBe(201);
    const choreId = choreResponse.json().chore.id as string;

    const crossFamilyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/chores/${choreId}/complete`,
      headers: authHeaders,
      payload: {
        memberId: memberAId,
        dueDate: "2026-06-15"
      }
    });

    expect(crossFamilyResponse.statusCode).toBe(400);
    expect(crossFamilyResponse.json()).toEqual({
      error: "That completion member does not belong to this family.",
      code: "CHORE_MEMBER_INVALID"
    });

    const firstCompletionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/chores/${choreId}/complete`,
      headers: authHeaders,
      payload: {
        memberId: memberBId,
        dueDate: "2026-06-15"
      }
    });

    expect(firstCompletionResponse.statusCode).toBe(201);

    const duplicateCompletionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/chores/${choreId}/complete`,
      headers: authHeaders,
      payload: {
        memberId: memberBId,
        dueDate: "2026-06-15"
      }
    });

    expect(duplicateCompletionResponse.statusCode).toBe(409);
    expect(duplicateCompletionResponse.json()).toEqual({
      error: "This chore was already completed for that family member on that date.",
      code: "CHORE_ALREADY_COMPLETED"
    });

    await app.close();
  });

  it("blocks cross-family event reads for non-members", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Read Family A" }
    });
    expect(familyAResponse.statusCode).toBe(201);
    const familyAId = familyAResponse.json().family.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Read Family B" }
    });
    expect(familyBResponse.statusCode).toBe(201);
    const familyBId = familyBResponse.json().family.id as string;

    const eventResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/events`,
      headers: authHeaders,
      payload: {
        title: "Soccer practice",
        startAt: "2026-06-15T16:00:00.000Z",
        endAt: "2026-06-15T17:00:00.000Z",
        allDay: false
      }
    });
    expect(eventResponse.statusCode).toBe(201);

    const { db } = await import("../src/db/client.js");
    const { familyMembers } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(familyMembers).where(eq(familyMembers.familyId, familyAId));

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyAId}/events`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "You are not a member of this family",
      code: "FAMILY_FORBIDDEN"
    });

    const allowedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyBId}/events`,
      headers: authHeaders
    });
    expect(allowedResponse.statusCode).toBe(200);

    await app.close();
  });

  it("blocks event edits from non-admin members who did not create the event", async () => {
    const app = buildApp();

    const familyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Edit Guard Family" }
    });
    expect(familyResponse.statusCode).toBe(201);
    const familyId = familyResponse.json().family.id as string;

    const eventResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/events`,
      headers: authHeaders,
      payload: {
        title: "Original title",
        startAt: "2026-06-15T16:00:00.000Z",
        endAt: "2026-06-15T17:00:00.000Z",
        allDay: false
      }
    });
    expect(eventResponse.statusCode).toBe(201);
    const eventId = eventResponse.json().event.id as string;

    const { db } = await import("../src/db/client.js");
    const { events, familyMembers } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { ensureUserProfile } = await import("../src/lib/userProvisioning.js");

    const otherUserId = "00000000-0000-4000-8000-000000000099";
    await ensureUserProfile(otherUserId, "other.member@homethread.test");

    await db
      .update(familyMembers)
      .set({ role: "member" })
      .where(eq(familyMembers.familyId, familyId));
    await db
      .update(events)
      .set({ createdBy: otherUserId })
      .where(eq(events.id, eventId));

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}/events/${eventId}`,
      headers: authHeaders,
      payload: {
        title: "Changed title"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Only the event creator or a family admin can edit this event",
      code: "EVENT_FORBIDDEN"
    });

    await app.close();
  });

  it("requires auth for AI routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ai/status"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Missing bearer token",
      code: "AUTH_REQUIRED"
    });
    await app.close();
  });

  it("rejects cross-family list and list-item access, and 404s instead of silently no-oping", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "List Family A" }
    });
    const familyAId = familyAResponse.json().family.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "List Family B" }
    });
    const familyBId = familyBResponse.json().family.id as string;

    const listResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/lists`,
      headers: authHeaders,
      payload: { title: "Groceries", type: "grocery", isShared: true }
    });
    expect(listResponse.statusCode).toBe(201);
    const listId = listResponse.json().list.id as string;

    const itemResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/lists/${listId}/items`,
      headers: authHeaders,
      payload: { content: "Milk" }
    });
    expect(itemResponse.statusCode).toBe(201);
    const itemId = itemResponse.json().item.id as string;

    const crossPatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyBId}/lists/${listId}`,
      headers: authHeaders,
      payload: { title: "Hijacked" }
    });
    expect(crossPatchResponse.statusCode).toBe(404);
    expect(crossPatchResponse.json()).toEqual({ error: "List not found", code: "LIST_NOT_FOUND" });

    const crossItemPatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyBId}/lists/${listId}/items/${itemId}`,
      headers: authHeaders,
      payload: { content: "Hijacked" }
    });
    expect(crossItemPatchResponse.statusCode).toBe(404);
    expect(crossItemPatchResponse.json()).toEqual({ error: "List not found", code: "LIST_NOT_FOUND" });

    const crossDeleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyBId}/lists/${listId}`,
      headers: authHeaders
    });
    expect(crossDeleteResponse.statusCode).toBe(404);

    const untouchedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyAId}/lists`,
      headers: authHeaders
    });
    expect(untouchedResponse.json().lists[0].title).toBe("Groceries");

    await app.close();
  });

  it("rejects cross-family chore access, and 404s instead of crashing", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Chore Family A" }
    });
    const familyAId = familyAResponse.json().family.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Chore Family B" }
    });
    const familyBId = familyBResponse.json().family.id as string;

    const choreResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/chores`,
      headers: authHeaders,
      payload: {
        title: "Take out trash",
        starsValue: 1,
        isActive: true
      }
    });
    expect(choreResponse.statusCode).toBe(201);
    const choreId = choreResponse.json().chore.id as string;

    const crossPatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyBId}/chores/${choreId}`,
      headers: authHeaders,
      payload: { title: "Hijacked" }
    });
    expect(crossPatchResponse.statusCode).toBe(404);
    expect(crossPatchResponse.json()).toEqual({ error: "Chore not found", code: "CHORE_NOT_FOUND" });

    await app.close();
  });

  it("rejects cross-family recipe mutations and cross-family recipe/meal grocery resolution", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Recipe Family A" }
    });
    const familyAId = familyAResponse.json().family.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Recipe Family B" }
    });
    const familyBId = familyBResponse.json().family.id as string;

    const recipeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/recipes`,
      headers: authHeaders,
      payload: {
        title: "Pancakes",
        ingredients: [{ name: "Flour", amount: "2", unit: "cup" }]
      }
    });
    expect(recipeResponse.statusCode).toBe(201);
    const recipeId = recipeResponse.json().recipe.id as string;

    const crossPatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyBId}/recipes/${recipeId}`,
      headers: authHeaders,
      payload: { title: "Hijacked" }
    });
    expect(crossPatchResponse.statusCode).toBe(404);
    expect(crossPatchResponse.json()).toEqual({ error: "Recipe not found", code: "RECIPE_NOT_FOUND" });

    const crossGroceryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/meals/to-grocery`,
      headers: authHeaders,
      payload: { recipeId }
    });
    expect(crossGroceryResponse.statusCode).toBe(404);
    expect(crossGroceryResponse.json()).toEqual({ error: "Recipe or meal not found", code: "RECIPE_NOT_FOUND" });

    const mealPlanResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/meals`,
      headers: authHeaders,
      payload: {
        weekStart: "2026-06-15",
        items: [{ dayOfWeek: 1, mealType: "dinner", customTitle: "Leftovers" }]
      }
    });
    expect(mealPlanResponse.statusCode).toBe(201);
    const mealPlanItemId = mealPlanResponse.json().items[0].id as string;

    const crossMealGroceryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyBId}/meals/to-grocery`,
      headers: authHeaders,
      payload: { mealPlanItemId }
    });
    expect(crossMealGroceryResponse.statusCode).toBe(404);
    expect(crossMealGroceryResponse.json()).toEqual({ error: "Recipe or meal not found", code: "MEAL_NOT_FOUND" });

    await app.close();
  });

  it("blocks non-members from insights and subscription-status endpoints", async () => {
    const app = buildApp();

    const familyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Gated Reads Family" }
    });
    const familyId = familyResponse.json().family.id as string;

    const { db } = await import("../src/db/client.js");
    const { familyMembers } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(familyMembers).where(eq(familyMembers.familyId, familyId));

    const insightsResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/insights/weekly`,
      headers: authHeaders
    });
    expect(insightsResponse.statusCode).toBe(403);
    expect(insightsResponse.json()).toEqual({
      error: "You are not a member of this family",
      code: "FAMILY_FORBIDDEN"
    });

    const subscriptionResponse = await app.inject({
      method: "GET",
      url: `/api/v1/subscriptions/status?familyId=${familyId}`,
      headers: authHeaders
    });
    expect(subscriptionResponse.statusCode).toBe(403);
    expect(subscriptionResponse.json()).toEqual({
      error: "You are not a member of this family",
      code: "FAMILY_FORBIDDEN"
    });

    await app.close();
  });

  it("never marks another user's notification as read", async () => {
    const app = buildApp();
    const { db } = await import("../src/db/client.js");
    const { notifications } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { ensureUserProfile } = await import("../src/lib/userProvisioning.js");

    const otherUserId = "00000000-0000-4000-8000-000000000099";
    await ensureUserProfile(otherUserId, "other.member@homethread.test");

    const [otherNotification] = await db
      .insert(notifications)
      .values({
        userId: otherUserId,
        type: "daily_digest",
        title: "Not yours",
        body: "This belongs to another user."
      })
      .returning();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/mark-read",
      headers: authHeaders,
      payload: { notificationIds: [otherNotification.id] }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updated: 0 });

    const stillUnread = await db.query.notifications.findFirst({
      where: eq(notifications.id, otherNotification.id)
    });
    expect(stillUnread?.readAt).toBeNull();

    await app.close();
  });

  it("rejects deleting a child device that belongs to another family", async () => {
    const app = buildApp();

    const familyAResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Child Device Family A" }
    });
    const familyAId = familyAResponse.json().family.id as string;

    const familyBResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Child Device Family B" }
    });
    const familyBId = familyBResponse.json().family.id as string;

    const childMemberResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyAId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Kid A",
        color: "#3157D5",
        role: "child",
        isVirtual: true
      }
    });
    expect(childMemberResponse.statusCode).toBe(201);
    const memberId = childMemberResponse.json().member.id as string;

    const { db } = await import("../src/db/client.js");
    const { childDevices } = await import("../src/db/schema.js");
    const [device] = await db
      .insert(childDevices)
      .values({
        familyId: familyAId,
        memberId,
        deviceToken: `test-device-token-${Date.now()}`
      })
      .returning();

    const crossDeleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyBId}/child-devices/${device.id}`,
      headers: authHeaders
    });

    expect(crossDeleteResponse.statusCode).toBe(404);
    expect(crossDeleteResponse.json()).toEqual({
      error: "Child device not found",
      code: "CHILD_DEVICE_NOT_FOUND"
    });

    await app.close();
  });

  it("blocks AI routes when plus entitlement is required", async () => {
    const previousRequirePlus = process.env.REQUIRE_PLUS;
    try {
      process.env.REQUIRE_PLUS = "true";
      vi.resetModules();
      const { buildApp: buildFreshApp } = await import("../src/app.js");
      const app = buildFreshApp();

      const familyResponse = await app.inject({
        method: "POST",
        url: "/api/v1/families",
        headers: authHeaders,
        payload: { name: "Plus Guard Family" }
      });
      expect(familyResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ai/status",
        headers: authHeaders
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: "Plus subscription required for this feature.",
        code: "PLUS_REQUIRED"
      });

      await app.close();
    } finally {
      if (previousRequirePlus === undefined) {
        delete process.env.REQUIRE_PLUS;
      } else {
        process.env.REQUIRE_PLUS = previousRequirePlus;
      }
      vi.resetModules();
    }
  });
});
