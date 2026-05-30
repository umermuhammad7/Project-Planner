import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { notifications } from "../src/db/schema.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};
const devUserId = "00000000-0000-4000-8000-000000000001";
const parkerFamilyId = "00000000-0000-4000-8000-000000000201";
const seededNotificationId = "00000000-0000-4000-8000-0000000008f1";

describe("notifications routes", () => {
  beforeEach(async () => {
    await db.delete(notifications).where(eq(notifications.id, seededNotificationId));
    await db.insert(notifications).values({
      id: seededNotificationId,
      userId: devUserId,
      familyId: parkerFamilyId,
      type: "daily_digest",
      title: "Heads up for today",
      body: "Two family events are coming up this afternoon."
    });
  });

  it("lists notifications for the authenticated user", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: authHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seededNotificationId,
          title: "Heads up for today",
          body: "Two family events are coming up this afternoon."
        })
      ])
    );
  });

  it("marks notifications as read for the authenticated user", async () => {
    const app = buildApp();
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: authHeaders
    });

    expect(listResponse.statusCode).toBe(200);
    const notificationId = listResponse.json().notifications.find((item: { id: string }) => item.id === seededNotificationId)
      ?.id as string;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/mark-read",
      headers: authHeaders,
      payload: {
        notificationIds: [notificationId]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      updated: 1
    });
  });
});
