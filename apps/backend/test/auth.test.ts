import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { authUsers, users } from "../src/db/schema.js";
import { env } from "../src/env.js";
import { ensureUserProfile } from "../src/lib/userProvisioning.js";

describe("auth guard", () => {
  it("requires bearer tokens for family routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/families/00000000-0000-4000-8000-000000000001"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Missing bearer token",
      code: "AUTH_REQUIRED"
    });
  });

  it("returns auth status without requiring a token", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/status"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      devTokenAllowed: true
    });
  });

  it("accepts the configured dev token in non-production", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "dev@homethread.local"
      }
    });
  });

  it("rejects unknown tokens when Supabase is not configured", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: "Bearer not-a-real-token"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "AUTH_INVALID"
    });
  });

  it("saves a push token for the authenticated user", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/auth/push-token",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        pushToken: "ExponentPushToken[test-token-1234]"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        pushToken: "ExponentPushToken[test-token-1234]"
      }
    });
  });

  it("updates the authenticated profile", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/profile",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        displayName: "Mara Parker",
        avatarUrl: null,
        phone: null,
        timezone: "Asia/Karachi",
        locale: "en-PK"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        displayName: "Mara Parker",
        timezone: "Asia/Karachi",
        locale: "en-PK"
      }
    });
  });

  it("saves notification preferences for the authenticated user", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/auth/notification-prefs",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        daily_digest: false,
        event_reminders: true,
        chore_reminders: false,
        family_activity: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        notificationPrefs: {
          daily_digest: false,
          event_reminders: true,
          chore_reminders: false,
          family_activity: true
        }
      }
    });
  });

  it("creates the local auth shadow user before provisioning a profile", async () => {
    const userId = "00000000-0000-4000-8000-0000000000a1";
    const email = "shadow-user@homethread.local";

    await db.delete(users).where(eq(users.id, userId));
    await db.delete(authUsers).where(eq(authUsers.id, userId));

    await ensureUserProfile(userId, email);

    const profile = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    const shadowRows = await db.select().from(authUsers).where(eq(authUsers.id, userId));

    expect(profile).toMatchObject({
      id: userId,
      email,
      displayName: "shadow-user"
    });
    expect(shadowRows).toHaveLength(1);
  });
});
