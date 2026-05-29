import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

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
});
