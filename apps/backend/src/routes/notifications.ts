import {
  dailyDigestPreviewResponseSchema,
  dailyDigestSendResponseSchema,
  markNotificationsReadResponseSchema,
  markNotificationsReadSchema,
  notificationsListResponseSchema,
  uuidSchema
} from "@homethread/shared";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { buildDailyDigest } from "../lib/familyDigest.js";
import { enqueueDailyDigestJob, getJobWorkerStatus } from "../jobs/boss.js";
import { notifications } from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";
import { sendNotificationToFamilyMembers } from "../lib/pushNotifications.js";

const familyQuerySchema = z.object({
  familyId: uuidSchema
});

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

  app.get("/daily-digest/preview", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyQuerySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const digest = await buildDailyDigest(familyId, currentUser.id);
    return dailyDigestPreviewResponseSchema.parse(digest);
  });

  app.get("/jobs/status", async () => {
    return getJobWorkerStatus();
  });

  app.post("/daily-digest/queue", async (request, reply) => {
    const { familyId } = familyQuerySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const jobId = await enqueueDailyDigestJob(familyId);
    if (!jobId) {
      return reply.status(409).send({
        error: "Job queue is not enabled on this server",
        code: "JOBS_DISABLED"
      });
    }

    return {
      queued: true,
      jobId,
      message: "Daily digest queued for background delivery."
    };
  });

  app.post("/daily-digest/send-now", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyQuerySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const digest = await buildDailyDigest(familyId, currentUser.id);
    const delivery = await sendNotificationToFamilyMembers({
      familyId,
      title: digest.title,
      body: digest.body,
      type: "daily_digest"
    });

    return dailyDigestSendResponseSchema.parse({
      queued: false,
      delivered: delivery.delivered,
      createdNotifications: delivery.createdNotifications,
      message:
        delivery.createdNotifications > 0
          ? "Daily digest created and push delivery attempted for signed-in family members."
          : "No signed-in family members with push tokens were available for this digest."
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
