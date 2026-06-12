import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { authUsers, families, familyMembers, notifications, users } from "../src/db/schema.js";
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

  it("reconciles an existing email onto the active auth user id", async () => {
    const oldUserId = "00000000-0000-4000-8000-0000000000b1";
    const newUserId = "00000000-0000-4000-8000-0000000000b2";
    const familyId = "00000000-0000-4000-8000-0000000000b3";
    const memberId = "00000000-0000-4000-8000-0000000000b4";
    const notificationId = "00000000-0000-4000-8000-0000000000b5";
    const email = "repair-user@homethread.local";

    await db.delete(notifications).where(eq(notifications.id, notificationId));
    await db.delete(familyMembers).where(eq(familyMembers.id, memberId));
    await db.delete(families).where(eq(families.id, familyId));
    await db.delete(users).where(eq(users.id, newUserId));
    await db.delete(users).where(eq(users.id, oldUserId));
    await db.delete(authUsers).where(eq(authUsers.id, newUserId));
    await db.delete(authUsers).where(eq(authUsers.id, oldUserId));

    await db.insert(authUsers).values({ id: oldUserId });
    await db.insert(users).values({
      id: oldUserId,
      email,
      displayName: "Repair User"
    });
    await db.insert(families).values({
      id: familyId,
      name: "Repair Family",
      createdBy: oldUserId
    });
    await db.insert(familyMembers).values({
      id: memberId,
      familyId,
      userId: oldUserId,
      displayName: "Repair User",
      color: "#3157D5",
      role: "admin",
      isVirtual: false
    });
    await db.insert(notifications).values({
      id: notificationId,
      userId: oldUserId,
      familyId,
      type: "family_activity",
      title: "Repair ping",
      body: "Testing user id reconciliation"
    });

    await ensureUserProfile(newUserId, email);

    const movedProfile = await db.query.users.findFirst({
      where: eq(users.id, newUserId)
    });
    const staleProfile = await db.query.users.findFirst({
      where: eq(users.id, oldUserId)
    });
    const family = await db.query.families.findFirst({
      where: eq(families.id, familyId)
    });
    const familyMember = await db.query.familyMembers.findFirst({
      where: eq(familyMembers.id, memberId)
    });
    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.id, notificationId)
    });

    expect(movedProfile).toMatchObject({
      id: newUserId,
      email,
      displayName: "Repair User"
    });
    expect(staleProfile).toBeUndefined();
    expect(family?.createdBy).toBe(newUserId);
    expect(familyMember?.userId).toBe(newUserId);
    expect(notification?.userId).toBe(newUserId);
  });
});
