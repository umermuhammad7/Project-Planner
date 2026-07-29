import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { familyMembers } from "../src/db/schema.js";
import { env } from "../src/env.js";
import { ensureUserProfile } from "../src/lib/userProvisioning.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";
const devUserId = "00000000-0000-4000-8000-000000000001";

async function downgradeDevToMember(familyId: string) {
  await db
    .update(familyMembers)
    .set({ role: "member" })
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, devUserId)));
}

describe("family management routes", () => {
  it("returns the family invite code to members", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      family: {
        id: parkerFamilyId,
        name: "The Parker Home",
        inviteCode: "HT2026"
      }
    });
  });

  it("regenerates the invite code for admins", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: {
        name: "Invite Regen Test Home"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id as string;
    const originalInviteCode = createResponse.json().family.inviteCode as string;

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/invite`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().inviteCode).toEqual(expect.any(String));
    expect(response.json().inviteCode).not.toBe(originalInviteCode);
  });

  it("creates a virtual child member for admins", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Test Child",
        color: "#F9735B",
        role: "child",
        isVirtual: true
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      member: {
        displayName: "Test Child",
        role: "child",
        isVirtual: true,
        userId: null
      }
    });
  });

  it("updates a virtual child member for admins", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Rename Me",
        color: "#2DAA84",
        role: "child",
        isVirtual: true
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const memberId = createResponse.json().member.id as string;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${parkerFamilyId}/members/${memberId}`,
      headers: authHeaders,
      payload: {
        displayName: "Renamed Child"
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      member: {
        id: memberId,
        displayName: "Renamed Child"
      }
    });
  });

  it("deletes a virtual child member for admins", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Delete Me",
        color: "#F4B740",
        role: "child",
        isVirtual: true
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const memberId = createResponse.json().member.id as string;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${parkerFamilyId}/members/${memberId}`,
      headers: authHeaders
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ deleted: true });
  });

  it("promotes a signed-in adult member to admin", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: {
        name: "Promote Admin Test Home"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const familyId = createResponse.json().family.id as string;

    const [member] = await db
      .insert(familyMembers)
      .values({
        familyId,
        userId: "00000000-0000-4000-8000-000000000099",
        displayName: "Second Adult",
        color: "#2DAA84",
        role: "member",
        isVirtual: false
      })
      .returning();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}/members/${member.id}`,
      headers: authHeaders,
      payload: {
        role: "admin"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      member: {
        id: member.id,
        role: "admin"
      }
    });
  });

  it("rejects promoting a virtual child profile to admin", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Cannot Promote Child",
        color: "#F9735B",
        role: "child",
        isVirtual: true
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const memberId = createResponse.json().member.id as string;

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${parkerFamilyId}/members/${memberId}`,
      headers: authHeaders,
      payload: {
        role: "admin"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Only signed-in adult members can be promoted to admin.",
      code: "PROMOTE_INVALID_TARGET"
    });
  });

  it("lets a plain household member create, update, and remove a virtual profile", async () => {
    const app = buildApp();
    const createFamilyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Member Parity Test Home" }
    });
    expect(createFamilyResponse.statusCode).toBe(201);
    const familyId = createFamilyResponse.json().family.id as string;
    await downgradeDevToMember(familyId);

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Member's Child",
        color: "#F9735B",
        role: "child",
        isVirtual: true
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const memberId = createResponse.json().member.id as string;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}/members/${memberId}`,
      headers: authHeaders,
      payload: { displayName: "Renamed by member" }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({ member: { displayName: "Renamed by member" } });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyId}/members/${memberId}`,
      headers: authHeaders
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ deleted: true });
  });

  it("does not block a permitted member's rename when the request resends the unchanged role", async () => {
    const app = buildApp();
    const createFamilyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Resend Role Test Home" }
    });
    expect(createFamilyResponse.statusCode).toBe(201);
    const familyId = createFamilyResponse.json().family.id as string;

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Original Name",
        color: "#2DAA84",
        role: "child",
        isVirtual: true
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const memberId = createResponse.json().member.id as string;

    await downgradeDevToMember(familyId);

    // Mirrors the mobile client's updateVirtualMember payload shape, which resends the
    // member's current, unchanged role on every plain rename (see useHomeThreadStore.ts).
    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}/members/${memberId}`,
      headers: authHeaders,
      payload: { displayName: "Renamed, Same Role", color: "#2DAA84", role: "child", isVirtual: true }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({ member: { displayName: "Renamed, Same Role" } });
  });

  it("blocks a plain member from changing a member's role", async () => {
    const app = buildApp();
    const createFamilyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Block Role Change Test Home" }
    });
    expect(createFamilyResponse.statusCode).toBe(201);
    const familyId = createFamilyResponse.json().family.id as string;

    await ensureUserProfile("00000000-0000-4000-8000-000000000098", "second-adult-098@homethread.local");
    const [secondAdult] = await db
      .insert(familyMembers)
      .values({
        familyId,
        userId: "00000000-0000-4000-8000-000000000098",
        displayName: "Second Adult",
        color: "#3157D5",
        role: "member",
        isVirtual: false
      })
      .returning();

    await downgradeDevToMember(familyId);

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}/members/${secondAdult.id}`,
      headers: authHeaders,
      payload: { role: "admin" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("blocks a plain member from creating an admin member", async () => {
    const app = buildApp();
    const createFamilyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Block Admin Create Test Home" }
    });
    expect(createFamilyResponse.statusCode).toBe(201);
    const familyId = createFamilyResponse.json().family.id as string;
    await downgradeDevToMember(familyId);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Self-Promoted",
        color: "#F4B740",
        role: "admin",
        isVirtual: true
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("blocks a plain member from removing an existing admin", async () => {
    const app = buildApp();
    const createFamilyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Block Admin Remove Test Home" }
    });
    expect(createFamilyResponse.statusCode).toBe(201);
    const familyId = createFamilyResponse.json().family.id as string;

    await ensureUserProfile("00000000-0000-4000-8000-000000000097", "second-admin-097@homethread.local");
    const [secondAdmin] = await db
      .insert(familyMembers)
      .values({
        familyId,
        userId: "00000000-0000-4000-8000-000000000097",
        displayName: "Second Admin",
        color: "#A85576",
        role: "admin",
        isVirtual: false
      })
      .returning();

    await downgradeDevToMember(familyId);

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyId}/members/${secondAdmin.id}`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("requires auth for member management routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/members`,
      payload: {
        displayName: "No Auth Child",
        color: "#3157D5",
        role: "child",
        isVirtual: true
      }
    });

    expect(response.statusCode).toBe(401);
  });
});
