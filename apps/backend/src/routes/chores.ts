import {
  completeChoreSchema,
  createChoreSchema,
  updateChoreSchema,
  uuidSchema
} from "@homethread/shared";
import { and, desc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { choreCompletions, chores, rewards } from "../db/schema.js";
import { sendError } from "../lib/http.js";
import { cancelChoreReminderForDate, syncChoreReminderSchedule } from "../lib/reminderScheduling.js";
import { requireAuth } from "../plugins/auth.js";
import { ensureFamilyMemberIds, requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

const choreParamsSchema = familyParamsSchema.extend({
  choreId: uuidSchema
});

const historyQuerySchema = z.object({
  memberId: uuidSchema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional()
});

export async function choresRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const rows = await db.query.chores.findMany({
      where: eq(chores.familyId, familyId),
      orderBy: desc(chores.createdAt)
    });

    return { chores: rows };
  });

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = createChoreSchema.parse(request.body);
    if (body.assignedTo) {
      const assignee = await ensureFamilyMemberIds(reply, familyId, [body.assignedTo], {
        code: "CHORE_ASSIGNEE_INVALID",
        message: "That assignee does not belong to this family."
      });
      if (!Array.isArray(assignee)) return;
    }

    const [chore] = await db
      .insert(chores)
      .values({
        familyId,
        title: body.title,
        description: body.description,
        icon: body.icon,
        starsValue: body.starsValue,
        assignedTo: body.assignedTo,
        recurrenceRule: body.recurrenceRule,
        dueTime: body.dueTime,
        isActive: body.isActive,
        createdBy: currentUser.id
      })
      .returning();

    await syncChoreReminderSchedule(chore);

    return reply.status(201).send({ chore });
  });

  app.get("/today", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const rows = await db.query.chores.findMany({
      where: and(eq(chores.familyId, familyId), eq(chores.isActive, true))
    });

    return { chores: rows };
  });

  app.get("/history", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const query = historyQuerySchema.parse(request.query);
    const rows = await db
      .select({
        completion: choreCompletions,
        chore: chores
      })
      .from(choreCompletions)
      .innerJoin(chores, eq(choreCompletions.choreId, chores.id))
      .where(
        and(
          eq(chores.familyId, familyId),
          query.memberId ? eq(choreCompletions.memberId, query.memberId) : undefined
        )
      )
      .orderBy(desc(choreCompletions.completedAt));

    return { completions: rows };
  });

  app.patch("/:choreId", async (request, reply) => {
    const { familyId, choreId } = choreParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = updateChoreSchema.parse(request.body);
    if (body.assignedTo) {
      const assignee = await ensureFamilyMemberIds(reply, familyId, [body.assignedTo], {
        code: "CHORE_ASSIGNEE_INVALID",
        message: "That assignee does not belong to this family."
      });
      if (!Array.isArray(assignee)) return;
    }

    const [chore] = await db
      .update(chores)
      .set({
        title: body.title,
        description: body.description,
        icon: body.icon,
        starsValue: body.starsValue,
        assignedTo: body.assignedTo,
        recurrenceRule: body.recurrenceRule,
        dueTime: body.dueTime,
        isActive: body.isActive
      })
      .where(and(eq(chores.familyId, familyId), eq(chores.id, choreId)))
      .returning();

    await syncChoreReminderSchedule(chore);

    return { chore };
  });

  app.delete("/:choreId", async (request, reply) => {
    const { familyId, choreId } = choreParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    await cancelChoreReminderForDate(familyId, choreId);
    await db.delete(chores).where(and(eq(chores.familyId, familyId), eq(chores.id, choreId)));
    return { deleted: true };
  });

  app.post("/:choreId/complete", async (request, reply) => {
    const { familyId, choreId } = choreParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = completeChoreSchema.parse(request.body);
    const chore = await db.query.chores.findFirst({
      where: and(eq(chores.familyId, familyId), eq(chores.id, choreId))
    });

    if (!chore) {
      return reply.status(404).send({ error: "Chore not found", code: "CHORE_NOT_FOUND" });
    }

    const completedMember = await ensureFamilyMemberIds(reply, familyId, [body.memberId], {
      code: "CHORE_MEMBER_INVALID",
      message: "That completion member does not belong to this family."
    });
    if (!Array.isArray(completedMember)) return;

    const existingCompletion = await db.query.choreCompletions.findFirst({
      where: and(
        eq(choreCompletions.choreId, choreId),
        eq(choreCompletions.memberId, body.memberId),
        eq(choreCompletions.dueDate, body.dueDate)
      )
    });

    if (existingCompletion) {
      return sendError(
        reply,
        409,
        "This chore was already completed for that family member on that date.",
        "CHORE_ALREADY_COMPLETED"
      );
    }

    const result = await db.transaction(async (tx) => {
      const [completion] = await tx
        .insert(choreCompletions)
        .values({
          choreId,
          memberId: body.memberId,
          dueDate: body.dueDate,
          notes: body.notes,
          photoUrl: body.photoUrl
        })
        .returning();

      const [reward] = await tx
        .insert(rewards)
        .values({
          familyId,
          memberId: body.memberId,
          stars: chore.starsValue,
          reason: "chore_complete",
          referenceId: completion.id
        })
        .returning();

      return { completion, reward };
    });

    await cancelChoreReminderForDate(familyId, choreId);

    return reply.status(201).send(result);
  });
}
