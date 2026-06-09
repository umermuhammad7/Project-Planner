import {
  createFamilySchema,
  joinFamilySchema,
  updateFamilySchema,
  uuidSchema
} from "@homethread/shared";
import { and, eq, sql } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { families, familyMembers, rewards, users } from "../db/schema.js";
import { sendError } from "../lib/http.js";
import { ensureUserProfile } from "../lib/userProvisioning.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyAdmin, requireFamilyMember } from "../plugins/familyAccess.js";

const idParamsSchema = z.object({
  id: uuidSchema
});

export async function familiesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const body = createFamilySchema.parse(request.body);
    await ensureUserProfile(currentUser.id, currentUser.email);

    const result = await db.transaction(async (tx) => {
      const [family] = await tx
        .insert(families)
        .values({
          name: body.name,
          avatarUrl: body.avatarUrl,
          createdBy: currentUser.id
        })
        .returning();

      const [member] = await tx
        .insert(familyMembers)
        .values({
          familyId: family.id,
          userId: currentUser.id,
          displayName: currentUser.email.split("@")[0],
          color: "#3157D5",
          role: "admin",
          isVirtual: false
        })
        .returning();

      return { family, member };
    });

    return reply.status(201).send(result);
  });

  app.get("/:id", async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, id);
    if (!membership) return;

    const family = await db.query.families.findFirst({
      where: eq(families.id, id)
    });

    const members = await db.query.familyMembers.findMany({
      where: eq(familyMembers.familyId, id)
    });

    const rewardRows = await db
      .select({
        memberId: rewards.memberId,
        stars: sql<number>`coalesce(sum(${rewards.stars}), 0)`
      })
      .from(rewards)
      .where(eq(rewards.familyId, id))
      .groupBy(rewards.memberId);

    const starBalanceByMemberId = new Map(rewardRows.map((row) => [row.memberId, Number(row.stars ?? 0)]));

    return {
      family,
      members: members.map((member) => ({
        ...member,
        starBalance: starBalanceByMemberId.get(member.id) ?? 0
      }))
    };
  });

  app.patch("/:id", async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const membership = await requireFamilyAdmin(request, reply, id);
    if (!membership) return;

    const body = updateFamilySchema.parse(request.body);
    const [family] = await db
      .update(families)
      .set({
        name: body.name,
        avatarUrl: body.avatarUrl
      })
      .where(eq(families.id, id))
      .returning();

    return { family };
  });

  app.post("/join", async (request, reply) => {
    const currentUser = request.currentUser!;
    const body = joinFamilySchema.parse({
      ...(request.body as Record<string, unknown>),
      inviteCode:
        typeof (request.body as { inviteCode?: unknown })?.inviteCode === "string"
          ? (request.body as { inviteCode: string }).inviteCode.trim().toUpperCase()
          : (request.body as { inviteCode?: unknown })?.inviteCode
    });
    await ensureUserProfile(currentUser.id, currentUser.email);

    const family = await db.query.families.findFirst({
      where: eq(families.inviteCode, body.inviteCode)
    });

    if (!family) {
      return sendError(reply, 404, "Invite code not found", "INVITE_NOT_FOUND");
    }

    const existing = await db.query.familyMembers.findFirst({
      where: and(eq(familyMembers.familyId, family.id), eq(familyMembers.userId, currentUser.id))
    });

    if (existing) {
      return { family, member: existing };
    }

    const [member] = await db
      .insert(familyMembers)
      .values({
        familyId: family.id,
        userId: currentUser.id,
        displayName: currentUser.email.split("@")[0],
        color: "#2DAA84",
        role: "member",
        isVirtual: false
      })
      .returning();

    return reply.status(201).send({ family, member });
  });

  app.post("/:id/invite", async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const membership = await requireFamilyAdmin(request, reply, id);
    if (!membership) return;

    const [family] = await db
      .update(families)
      .set({
        inviteCode: sql<string>`substr(md5(random()::text), 0, 9)`
      })
      .where(eq(families.id, id))
      .returning();

    return { inviteCode: family.inviteCode };
  });

  app.delete("/:id/leave", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { id } = idParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, id);
    if (!membership) return;

    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, id), eq(familyMembers.userId, currentUser.id)));

    return { left: true };
  });
}
