import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};
const familyId = "00000000-0000-4000-8000-000000000201";

describe("subscriptions routes", () => {
  it("returns the current family subscription status", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/subscriptions/status?familyId=${familyId}`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      familyId,
      subscriptionStatus: expect.any(String),
      provider: expect.any(String)
    });
  });

  it("accepts a RevenueCat test webhook", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/revenuecat",
      payload: {
        api_version: "1.0",
        event: {
          id: "evt_test_1",
          type: "TEST",
          app_user_id: familyId
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      test: true
    });
  });
});
