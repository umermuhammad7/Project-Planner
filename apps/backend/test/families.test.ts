import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

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
});
