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
import { sendError } from "../lib/http.js";
import { countFamilyAdmins } from "../lib/householdAdmins.js";
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
    const existing = await db.query.familyMembers.findFirst({
      where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, memberId))
    });

    if (!existing) {
      return sendError(reply, 404, "Member not found", "MEMBER_NOT_FOUND");
    }

    if (body.role !== undefined) {
      if (body.role === "admin") {
        if (existing.role !== "member" || existing.isVirtual || !existing.userId) {
          return sendError(
            reply,
            400,
            "Only signed-in adult members can be promoted to admin.",
            "PROMOTE_INVALID_TARGET"
          );
        }
      }

      if (existing.role === "admin" && body.role !== "admin") {
        const adminCount = await countFamilyAdmins(familyId);
        if (adminCount <= 1) {
          return sendError(
            reply,
            409,
            "Promote another adult to admin before changing this admin role.",
            "LAST_ADMIN_ROLE_CHANGE_BLOCKED"
          );
        }
      }
    }

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

    const existing = await db.query.familyMembers.findFirst({
      where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, memberId))
    });

    if (!existing) {
      return sendError(reply, 404, "Member not found", "MEMBER_NOT_FOUND");
    }

    if (existing.role === "admin") {
      const adminCount = await countFamilyAdmins(familyId);
      if (adminCount <= 1) {
        return sendError(
          reply,
          409,
          "Promote another adult to admin before removing this admin.",
          "LAST_ADMIN_REMOVE_BLOCKED"
        );
      }
    }

    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, memberId)));

    return { deleted: true };
  });
}
