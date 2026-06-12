import { and, eq, inArray } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";

import { db } from "../db/client.js";
import { familyMembers } from "../db/schema.js";
import { sendError } from "../lib/http.js";

export async function requireFamilyMember(request: FastifyRequest, reply: FastifyReply, familyId: string) {
  const userId = request.currentUser?.id;

  if (!userId) {
    return sendError(reply, 401, "Authentication is required", "AUTH_REQUIRED");
  }

  const membership = await db.query.familyMembers.findFirst({
    where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId))
  });

  if (!membership) {
    return sendError(reply, 403, "You are not a member of this family", "FAMILY_FORBIDDEN");
  }

  return membership;
}

export async function requireFamilyAdmin(request: FastifyRequest, reply: FastifyReply, familyId: string) {
  const membership = await requireFamilyMember(request, reply, familyId);

  if (!membership || reply.sent) {
    return undefined;
  }

  if (membership.role !== "admin") {
    return sendError(reply, 403, "Admin access is required", "ADMIN_REQUIRED");
  }

  return membership;
}

export async function ensureFamilyMemberIds(
  reply: FastifyReply,
  familyId: string,
  memberIds: string[],
  options: {
    code?: string;
    message?: string;
  } = {}
) {
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueMemberIds.length === 0) {
    return [];
  }

  const rows = await db.query.familyMembers.findMany({
    where: and(eq(familyMembers.familyId, familyId), inArray(familyMembers.id, uniqueMemberIds))
  });

  if (rows.length !== uniqueMemberIds.length) {
    return sendError(
      reply,
      400,
      options.message ?? "One or more members do not belong to this family.",
      options.code ?? "MEMBER_FAMILY_MISMATCH"
    );
  }

  return rows;
}
