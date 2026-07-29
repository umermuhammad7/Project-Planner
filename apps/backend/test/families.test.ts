import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { families, familyMembers } from "../src/db/schema.js";
import { env } from "../src/env.js";
import { ensureUserProfile } from "../src/lib/userProvisioning.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const devUserId = "00000000-0000-4000-8000-000000000001";

async function downgradeDevToMember(familyId: string) {
  await db
    .update(familyMembers)
    .set({ role: "member" })
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, devUserId)));
}

describe("family setup routes", () => {
  it("creates a family and admin membership for the authenticated user", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: {
        name: "Test Household"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      family: {
        name: "Test Household"
      },
      member: {
        role: "admin",
        userId: "00000000-0000-4000-8000-000000000001"
      }
    });
    expect(response.json().family.inviteCode).toEqual(expect.any(String));
  });

  it("joins an existing family when the invite code matches", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/families/join",
      headers: authHeaders,
      payload: {
        inviteCode: "HT2026"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      family: {
        id: "00000000-0000-4000-8000-000000000201",
        name: "The Parker Home",
        inviteCode: "HT2026"
      },
      member: {
        userId: "00000000-0000-4000-8000-000000000001",
        role: "admin"
      }
    });
  });

  it("normalizes invite codes before joining a family", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/families/join",
      headers: authHeaders,
      payload: {
        inviteCode: "  ht2026  "
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      family: {
        inviteCode: "HT2026"
      }
    });
  });

  it("joins a family whose invite code is stored lowercase, matching real invite-code generation", async () => {
    const app = buildApp();
    await ensureUserProfile(devUserId, "dev@homethread.local");

    // Deliberately omit inviteCode so the real DB default generates it, same as
    // production (`substr(md5(random()::text), 0, 9)`, always lowercase hex).
    const [family] = await db
      .insert(families)
      .values({
        name: "Lowercase Code Home",
        createdBy: devUserId
      })
      .returning();

    expect(family.inviteCode).toMatch(/^[0-9a-f]+$/);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/families/join",
      headers: authHeaders,
      payload: {
        inviteCode: family.inviteCode.toUpperCase()
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      family: {
        id: family.id,
        inviteCode: family.inviteCode
      },
      alreadyMember: false
    });
  });

  it("rejects unknown invite codes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/families/join",
      headers: authHeaders,
      payload: {
        inviteCode: "NOTREAL1"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Invite code not found",
      code: "INVITE_NOT_FOUND"
    });
  });

  it("requires auth for family setup routes", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      payload: { name: "No Auth Family" }
    });
    const joinResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families/join",
      payload: { inviteCode: "HT2026" }
    });

    expect(createResponse.statusCode).toBe(401);
    expect(joinResponse.statusCode).toBe(401);
  });

  it("lets admins rename a family", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: {
        name: "Rename Test Home"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id;

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}`,
      headers: authHeaders,
      payload: {
        name: "Renamed Test Home"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      family: {
        id: familyId,
        name: "Renamed Test Home"
      }
    });
  });

  it("blocks a plain member from renaming the household", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Member Rename Block Test Home" }
    });
    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id as string;
    await downgradeDevToMember(familyId);

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}`,
      headers: authHeaders,
      payload: { name: "Should Not Rename" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("blocks a plain member from regenerating the invite code", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Member Invite Block Test Home" }
    });
    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id as string;
    await downgradeDevToMember(familyId);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/invite`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("blocks the last admin from leaving a household", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: {
        name: "Solo Admin Home"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id;

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyId}/leave`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Promote another adult to admin before leaving this household.",
      code: "LAST_ADMIN_LEAVE_BLOCKED"
    });
  });

  it("lets an admin leave after another admin exists", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: {
        name: "Leave Test Home"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id as string;

    await db.insert(familyMembers).values({
      familyId,
      userId: "00000000-0000-4000-8000-000000000099",
      displayName: "Second Admin",
      color: "#2DAA84",
      role: "admin",
      isVirtual: false
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyId}/leave`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ left: true });
  });
});
