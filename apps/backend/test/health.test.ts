import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

describe("health route", () => {
  it("returns service health with database status", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "homethread-backend",
      db: "ok"
    });
    await app.close();
  });
});
