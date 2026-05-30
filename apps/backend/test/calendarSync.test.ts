import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "../src/db/client.js";
import { calendarConnections, events } from "../src/db/schema.js";
import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const originalGoogleClientId = env.GOOGLE_OAUTH_CLIENT_ID;
const originalGoogleClientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
const originalGoogleRedirectUri = env.GOOGLE_OAUTH_REDIRECT_URI;
const originalGoogleScopes = env.GOOGLE_CALENDAR_SCOPES;

describe("calendar-sync routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    env.GOOGLE_OAUTH_CLIENT_ID = undefined;
    env.GOOGLE_OAUTH_CLIENT_SECRET = undefined;
    env.GOOGLE_OAUTH_REDIRECT_URI = undefined;
    env.GOOGLE_CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
  });

  afterEach(async () => {
    env.GOOGLE_OAUTH_CLIENT_ID = originalGoogleClientId;
    env.GOOGLE_OAUTH_CLIENT_SECRET = originalGoogleClientSecret;
    env.GOOGLE_OAUTH_REDIRECT_URI = originalGoogleRedirectUri;
    env.GOOGLE_CALENDAR_SCOPES = originalGoogleScopes;
    await db.delete(calendarConnections);
    await db.delete(events).where(eq(events.externalSource, "ical"));
  });

  it("requires bearer tokens", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/calendar-sync/status"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns truthful sync status", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/calendar-sync/status",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      googleConnectImplemented: false,
      icalImportImplemented: true
    });
  });

  it("lists calendar connections for a family", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/calendar-sync/connections?familyId=00000000-0000-4000-8000-000000000201",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ connections: [] });
  });

  it("returns an auth url when Google OAuth is configured", async () => {
    env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";

    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/google/connect",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        familyId: "00000000-0000-4000-8000-000000000201"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.authUrl).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(body.authUrl).toContain("client_id=google-client-id");
    expect(body.authUrl).toContain(encodeURIComponent("http://localhost:3001/api/v1/calendar-sync/google/callback"));
  });

  it("stores a google calendar connection after callback exchange", async () => {
    env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";

    const app = buildApp();
    const connectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/google/connect",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        familyId: "00000000-0000-4000-8000-000000000201"
      }
    });

    const authUrl = new URL(connectResponse.json().authUrl);
    const state = authUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "google-access-token",
            refresh_token: "google-refresh-token",
            expires_in: 3600
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "primary", primary: true }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const callbackResponse = await app.inject({
      method: "GET",
      url: `/api/v1/calendar-sync/google/callback?code=test-code&state=${encodeURIComponent(state!)}`
    });

    expect(callbackResponse.statusCode).toBe(200);
    expect(callbackResponse.body).toContain("Google Calendar connected");

    const connectionsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/calendar-sync/connections?familyId=00000000-0000-4000-8000-000000000201",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      }
    });

    expect(connectionsResponse.statusCode).toBe(200);
    expect(connectionsResponse.json()).toEqual({
      connections: [
        expect.objectContaining({
          provider: "google",
          externalCalendarId: "primary",
          isActive: true
        })
      ]
    });

    await app.close();
  });

  it("rejects callbacks with invalid state", async () => {
    env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";

    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/calendar-sync/google/callback?code=test-code&state=bad-state"
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("could not verify the sign-in state");
    await app.close();
  });

  it("stores an iCal feed connection for the family", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/ical",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        familyId: "00000000-0000-4000-8000-000000000201",
        icalUrl: "https://example.com/family.ics"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ok: true,
      message: "iCal feed saved. Use Sync now to import future events from this feed."
    });

    const connectionsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/calendar-sync/connections?familyId=00000000-0000-4000-8000-000000000201",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      }
    });

    expect(connectionsResponse.statusCode).toBe(200);
    expect(connectionsResponse.json()).toEqual({
      connections: [
        expect.objectContaining({
          provider: "ical",
          icalUrl: "https://example.com/family.ics",
          isActive: true
        })
      ]
    });

    await app.close();
  });

  it("imports future iCal events on manual sync and skips duplicates", async () => {
    const app = buildApp();
    const familyId = "00000000-0000-4000-8000-000000000201";
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const stamp = future.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
    const feed = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:sync-test-event-1
SUMMARY:Imported soccer practice
DTSTART:${stamp}
DTEND:${stamp}
END:VEVENT
END:VCALENDAR`;

    await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/ical",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        familyId,
        icalUrl: "https://example.com/family.ics"
      }
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(feed, { status: 200, headers: { "Content-Type": "text/calendar" } })
      )
    );

    const firstSync = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/sync",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: { familyId }
    });

    expect(firstSync.statusCode).toBe(200);
    expect(firstSync.json()).toMatchObject({
      ok: true,
      results: [
        expect.objectContaining({
          provider: "ical",
          added: 1,
          skipped: 0
        })
      ]
    });

    const secondSync = await app.inject({
      method: "POST",
      url: "/api/v1/calendar-sync/sync",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: { familyId }
    });

    expect(secondSync.statusCode).toBe(200);
    expect(secondSync.json()).toMatchObject({
      results: [
        expect.objectContaining({
          provider: "ical",
          added: 0,
          skipped: 1
        })
      ]
    });

    await app.close();
  });
});
