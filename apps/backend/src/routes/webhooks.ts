import { timingSafeEqual } from "node:crypto";

import { revenueCatWebhookSchema } from "@homethread/shared";
import { eq, or } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db } from "../db/client.js";
import { families } from "../db/schema.js";
import { env } from "../env.js";
import { sendError } from "../lib/http.js";

function isValidWebhookSecret(header: string | undefined, secret: string): boolean {
  if (!header) {
    return false;
  }
  const headerBuffer = Buffer.from(header, "utf8");
  const secretBuffer = Buffer.from(secret, "utf8");
  return headerBuffer.length === secretBuffer.length && timingSafeEqual(headerBuffer, secretBuffer);
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/revenuecat", async (request, reply) => {
    const secret = env.REVENUECAT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return sendError(
        reply,
        503,
        "RevenueCat webhook secret is not configured on this server.",
        "WEBHOOK_NOT_CONFIGURED"
      );
    }

    const header = request.headers.authorization?.replace(/^Bearer\s+/u, "");
    if (!isValidWebhookSecret(header, secret)) {
      return sendError(reply, 401, "RevenueCat webhook secret is invalid", "WEBHOOK_FORBIDDEN");
    }

    const payload = revenueCatWebhookSchema.parse(request.body);
    const appUserId = payload.event.original_app_user_id || payload.event.app_user_id;

    const family = await db.query.families.findFirst({
      where: or(eq(families.id, appUserId), eq(families.revenueCatId, appUserId))
    });

    if (!family) {
      return { ok: true, ignored: true, reason: "No matching family for RevenueCat app user id." };
    }

    const isActive =
      payload.event.type === "INITIAL_PURCHASE" ||
      payload.event.type === "RENEWAL" ||
      payload.event.type === "UNCANCELLATION";
    const isCancelled =
      payload.event.type === "CANCELLATION" ||
      payload.event.type === "EXPIRATION" ||
      payload.event.type === "BILLING_ISSUE";

    if (!isActive && !isCancelled && payload.event.type !== "TEST") {
      return { ok: true, ignored: true, reason: `Webhook ${payload.event.type} does not change family subscription state.` };
    }

    if (payload.event.type === "TEST") {
      return { ok: true, test: true };
    }

    const [updatedFamily] = await db
      .update(families)
      .set({
        revenueCatId: family.revenueCatId ?? appUserId,
        subscriptionStatus: isActive ? "plus" : "cancelled",
        subscriptionExpiresAt: payload.event.expiration_at_ms
          ? new Date(payload.event.expiration_at_ms)
          : family.subscriptionExpiresAt
      })
      .where(eq(families.id, family.id))
      .returning();

    return {
      ok: true,
      familyId: updatedFamily.id,
      subscriptionStatus: updatedFamily.subscriptionStatus
    };
  });
}
