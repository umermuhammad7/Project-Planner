import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

describe("travel reminder route", () => {
  it("returns an honest unavailable state when routing is not configured", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/families/00000000-0000-4000-8000-000000000201/events/00000000-0000-4000-8000-000000000301/travel-reminder",
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      supported: false,
      provider: "unavailable",
      recommendedLeadMinutes: null
    });
  });
});
