import { subscriptionStatusResponseSchema, uuidSchema } from "@homethread/shared";
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { families } from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const querySchema = z.object({
  familyId: uuidSchema
});

export async function subscriptionsRoutes(app: FastifyInstance) {
  app.get("/status", { preHandler: requireAuth }, async (request, reply) => {
    const { familyId } = querySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const family = await db.query.families.findFirst({
      where: eq(families.id, familyId)
    });

    return subscriptionStatusResponseSchema.parse({
      familyId,
      subscriptionStatus: family?.subscriptionStatus ?? "free",
      subscriptionExpiresAt: family?.subscriptionExpiresAt?.toISOString() ?? null,
      revenueCatId: family?.revenueCatId ?? null,
      provider: family?.revenueCatId ? "revenuecat" : "none",
      message: family?.revenueCatId
        ? "A store billing profile is linked for this household."
        : "No paid plan is linked to this household yet."
    });
  });
}
