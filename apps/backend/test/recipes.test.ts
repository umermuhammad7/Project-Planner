import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

describe("recipes route", () => {
  it("requires bearer tokens for family recipe routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/families/00000000-0000-4000-8000-000000000201/recipes"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Missing bearer token",
      code: "AUTH_REQUIRED"
    });
  });
});
