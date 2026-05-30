import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";

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
