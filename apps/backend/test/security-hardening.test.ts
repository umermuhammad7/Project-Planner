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
