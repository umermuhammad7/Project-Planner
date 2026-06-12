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

  it("masks saved iCal feed urls and rejects unsafe local feeds", async () => {
    const app = buildApp();

    const familyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Calendar Security Family" }
    });
    expect(familyResponse.statusCode).toBe(201);
    const familyId = familyResponse.json().family.id as string;

    const saveResponse = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/ical",
      headers: authHeaders,
      payload: {
        familyId,
        icalUrl: "https://1.1.1.1/private-feed.ics?token=secret-value"
      }
    });

    expect(saveResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/calendar-sync/connections?familyId=${familyId}`,
      headers: authHeaders
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "ical",
          icalUrl: "https://1.1.1.1/..."
        })
      ])
    );

    const unsafeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/ical",
      headers: authHeaders,
      payload: {
        familyId,
        icalUrl: "https://localhost/private.ics"
      }
    });

    expect(unsafeResponse.statusCode).toBe(400);
    expect(unsafeResponse.json()).toEqual({
      error: "iCal feeds must use a public hostname.",
      code: "ICAL_URL_NOT_ALLOWED"
    });

    await app.close();
  });
});
