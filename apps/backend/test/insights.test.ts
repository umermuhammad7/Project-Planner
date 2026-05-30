import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};
const familyId = "00000000-0000-4000-8000-000000000201";

describe("insights routes", () => {
  it("returns weekly family summary metrics", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/insights/weekly`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      windowDays: 7,
      upcomingEvents: expect.any(Number),
      openChores: expect.any(Number),
      plannedMeals: expect.any(Number),
      unreadNotifications: expect.any(Number),
      activeMembers: expect.any(Number)
    });
  });

  it("returns chore completion stats per member", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/insights/chores`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      windowDays: 30,
      members: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          completedCount: expect.any(Number),
          outstandingCount: expect.any(Number),
          starsEarned: expect.any(Number)
        })
      ])
    });
  });

  it("returns busyness breakdown for upcoming family events", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/insights/busyness`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      windowDays: 14,
      days: expect.any(Array),
      members: expect.any(Array)
    });
  });
});
