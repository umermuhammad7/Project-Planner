import {
  markNotificationsReadResponseSchema,
  markNotificationsReadSchema,
  notificationsListResponseSchema
} from "@homethread/shared";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db } from "../db/client.js";
import { notifications } from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";

export async function notificationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request) => {
    const currentUser = request.currentUser!;
    const rows = await db.query.notifications.findMany({
      where: eq(notifications.userId, currentUser.id),
      orderBy: [desc(notifications.sentAt)],
      limit: 25
    });

    return notificationsListResponseSchema.parse({
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        sentAt: row.sentAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
        familyId: row.familyId ?? null
      }))
    });
  });

  app.post("/mark-read", async (request) => {
    const currentUser = request.currentUser!;
    const body = markNotificationsReadSchema.parse(request.body);

    const updatedRows = await db
      .update(notifications)
      .set({
        readAt: new Date()
      })
      .where(
        and(
          eq(notifications.userId, currentUser.id),
          inArray(notifications.id, body.notificationIds),
          isNull(notifications.readAt)
        )
      )
      .returning({ id: notifications.id });

    return markNotificationsReadResponseSchema.parse({
      updated: updatedRows.length
    });
  });
}
