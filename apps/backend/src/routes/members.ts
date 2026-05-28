import {
  createMemberSchema,
  updateMemberSchema,
  uuidSchema
} from "@homethread/shared";
import { and, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { familyMembers } from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyAdmin, requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

const memberParamsSchema = familyParamsSchema.extend({
  memberId: uuidSchema
});

export async function membersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const members = await db.query.familyMembers.findMany({
      where: eq(familyMembers.familyId, familyId)
    });

    return { members };
  });

  app.post("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyAdmin(request, reply, familyId);
    if (!membership) return;

    const body = createMemberSchema.parse(request.body);
    const [member] = await db
      .insert(familyMembers)
      .values({
        familyId,
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        color: body.color,
        role: body.role,
        isVirtual: body.isVirtual,
        dateOfBirth: body.dateOfBirth
      })
      .returning();

    return reply.status(201).send({ member });
  });

  app.patch("/:memberId", async (request, reply) => {
    const { familyId, memberId } = memberParamsSchema.parse(request.params);
    const membership = await requireFamilyAdmin(request, reply, familyId);
    if (!membership) return;

    const body = updateMemberSchema.parse(request.body);
    const [member] = await db
      .update(familyMembers)
      .set({
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        color: body.color,
        role: body.role,
        isVirtual: body.isVirtual,
        dateOfBirth: body.dateOfBirth
      })
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, memberId)))
      .returning();

    return { member };
  });

  app.delete("/:memberId", async (request, reply) => {
    const { familyId, memberId } = memberParamsSchema.parse(request.params);
    const membership = await requireFamilyAdmin(request, reply, familyId);
    if (!membership) return;

    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, memberId)));

    return { deleted: true };
  });
}
