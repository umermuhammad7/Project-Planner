import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

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
});
