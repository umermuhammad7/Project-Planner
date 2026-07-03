import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";

describe("event routes", () => {
  it("returns a single event by id", async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/events`,
      headers: authHeaders,
      payload: {
        title: "AW-157 lookup probe",
        startAt: "2026-08-01T16:00:00.000Z",
        endAt: "2026-08-01T17:00:00.000Z",
        allDay: false
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const eventId = createResponse.json().event.id as string;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/events/${eventId}`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      event: {
        id: eventId,
        title: "AW-157 lookup probe"
      }
    });
  });

  it("returns 404 for a missing event id", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/events/00000000-0000-4000-8000-00000000e157`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Event not found",
      code: "EVENT_NOT_FOUND"
    });
  });
});
