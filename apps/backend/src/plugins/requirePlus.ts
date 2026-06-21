import { eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";

import { db } from "../db/client.js";
import { families, familyMembers } from "../db/schema.js";
import { env } from "../env.js";
import { sendError } from "../lib/http.js";

async function resolveFamilyId(request: FastifyRequest): Promise<string | null> {
  const params = request.params as { familyId?: string } | undefined;
  if (params?.familyId) {
    return params.familyId;
  }

  const userId = request.currentUser?.id;
  if (!userId) {
    return null;
  }

  const membership = await db.query.familyMembers.findFirst({
    where: eq(familyMembers.userId, userId)
  });

  return membership?.familyId ?? null;
}

export async function requirePlus(request: FastifyRequest, reply: FastifyReply) {
  if (!env.REQUIRE_PLUS) {
    return;
  }

  const userId = request.currentUser?.id;
  if (!userId) {
    return sendError(reply, 401, "Authentication is required", "AUTH_REQUIRED");
  }

  const familyId = await resolveFamilyId(request);
  if (!familyId) {
    return sendError(reply, 403, "Join a household before using this feature.", "FAMILY_REQUIRED");
  }

  const family = await db.query.families.findFirst({
    where: eq(families.id, familyId)
  });

  if (!family || family.subscriptionStatus !== "plus") {
    return sendError(reply, 403, "Plus subscription required for this feature.", "PLUS_REQUIRED");
  }
}
