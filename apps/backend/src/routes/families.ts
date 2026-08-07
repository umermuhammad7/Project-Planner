import {
  createFamilySchema,
  joinFamilySchema,
  updateFamilySchema,
  uuidSchema
} from "@homethread/shared";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { families, familyMembers, rewards, users } from "../db/schema.js";
import { sendError } from "../lib/http.js";
import { countFamilyAdmins } from "../lib/householdAdmins.js";
import { withUniqueInviteCodeRetry } from "../lib/inviteCode.js";
import { ensureUserProfile } from "../lib/userProvisioning.js";
import { isChildPairingCode } from "../lib/childPairing.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyAdmin, requireFamilyMember } from "../plugins/familyAccess.js";

const idParamsSchema = z.object({
  id: uuidSchema
});

export async function familiesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  const joinFamilyRateLimit = {
    max: 8,
    timeWindow: "1 minute"
  } as const;

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const body = createFamilySchema.parse(request.body);
    await ensureUserProfile(currentUser.id, currentUser.email);

    const existingMembership = await db.query.familyMembers.findFirst({
      where: eq(familyMembers.userId, currentUser.id)
    });

    const result = await db.transaction(async (tx) => {
      const [family] = await withUniqueInviteCodeRetry((inviteCode) =>
        tx
          .insert(families)
          .values({
            name: body.name,
            avatarUrl: body.avatarUrl,
            createdBy: currentUser.id,
            inviteCode
          })
          .returning()
      );

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

    return reply.status(201).send({ ...result, hadExistingHousehold: Boolean(existingMembership) });
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

    const linkedUserIds = members
      .map((member) => member.userId)
      .filter((userId): userId is string => Boolean(userId));
    const linkedUsers = linkedUserIds.length
      ? await db.query.users.findMany({ where: inArray(users.id, linkedUserIds) })
      : [];
    const avatarUrlByUserId = new Map(linkedUsers.map((user) => [user.id, user.avatarUrl]));

    return {
      family,
      members: members.map((member) => ({
        ...member,
        avatarUrl: (member.userId ? avatarUrlByUserId.get(member.userId) : undefined) ?? member.avatarUrl,
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

  app.post("/join", { config: { rateLimit: joinFamilyRateLimit } }, async (request, reply) => {
    const currentUser = request.currentUser!;
    const body = joinFamilySchema.parse({
      ...(request.body as Record<string, unknown>),
      inviteCode:
        typeof (request.body as { inviteCode?: unknown })?.inviteCode === "string"
          ? (request.body as { inviteCode: string }).inviteCode.trim().toUpperCase()
          : (request.body as { inviteCode?: unknown })?.inviteCode
    });
    await ensureUserProfile(currentUser.id, currentUser.email);

    if (isChildPairingCode(body.inviteCode)) {
      return sendError(
        reply,
        400,
        "That is a child pairing code. Adults join with the adult invite code from the household owner.",
        "ADULT_INVITE_REQUIRED"
      );
    }

    const family = await db.query.families.findFirst({
      where: ilike(families.inviteCode, body.inviteCode)
    });

    if (!family) {
      return sendError(reply, 404, "Invite code not found", "INVITE_NOT_FOUND");
    }

    const existing = await db.query.familyMembers.findFirst({
      where: and(eq(familyMembers.familyId, family.id), eq(familyMembers.userId, currentUser.id))
    });

    if (existing) {
      return { family, member: existing, alreadyMember: true };
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

    return reply.status(201).send({ family, member, alreadyMember: false });
  });

  app.post("/:id/invite", async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const membership = await requireFamilyAdmin(request, reply, id);
    if (!membership) return;

    const [family] = await withUniqueInviteCodeRetry((inviteCode) =>
      db.update(families).set({ inviteCode }).where(eq(families.id, id)).returning()
    );

    return { inviteCode: family.inviteCode };
  });

  app.delete("/:id/leave", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { id } = idParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, id);
    if (!membership) return;

    if (membership.role === "admin") {
      const adminCount = await countFamilyAdmins(id);
      if (adminCount <= 1) {
        return sendError(
          reply,
          409,
          "Promote another adult to admin before leaving this household.",
          "LAST_ADMIN_LEAVE_BLOCKED"
        );
      }
    }

    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, id), eq(familyMembers.userId, currentUser.id)));

    return { left: true };
  });
}
