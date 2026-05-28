import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

describe("health route", () => {
  it("returns service health", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "homethread-backend"
    });
  });
});
