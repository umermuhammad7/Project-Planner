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
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

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

    return { chore };
  });

  app.delete("/:choreId", async (request, reply) => {
    const { familyId, choreId } = choreParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

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

    return reply.status(201).send(result);
  });
}
