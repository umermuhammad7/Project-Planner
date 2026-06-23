import {
  childDeviceChoresResponseSchema,
  childDeviceMeResponseSchema,
  childDevicePushTokenSchema,
  childPairingCodeSchema,
  completeChoreSchema,
  pairChildDeviceResponseSchema,
  uuidSchema
} from "@homethread/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import {
  childDevices,
  childPairingCodes,
  choreCompletions,
  chores,
  families,
  familyMembers,
  rewards
} from "../db/schema.js";
import { isChildPairingCode, generateChildDeviceToken, clearFailedChildPairAttempts, isChildPairAttemptBlocked, recordFailedChildPairAttempt } from "../lib/childPairing.js";
import { sendError } from "../lib/http.js";
import { clearChildDevicePushToken } from "../lib/pushNotifications.js";
import { logSafeError, redactForLog } from "../lib/redactLog.js";
import { cancelChoreReminderForDate } from "../lib/reminderScheduling.js";
import { requireChildDeviceAuth } from "../plugins/childDeviceAuth.js";

const choreParamsSchema = z.object({
  choreId: uuidSchema
});

async function getMemberStarBalance(familyId: string, memberId: string) {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${rewards.stars}), 0)`
    })
    .from(rewards)
    .where(and(eq(rewards.familyId, familyId), eq(rewards.memberId, memberId)));

  return Number(row?.total ?? 0);
}

async function revokeActiveChildDevicesForMember(
  familyId: string,
  memberId: string,
  executor: Pick<typeof db, "update" | "query"> = db
) {
  const activeDevices = await executor.query.childDevices.findMany({
    where: and(
      eq(childDevices.familyId, familyId),
      eq(childDevices.memberId, memberId),
      isNull(childDevices.revokedAt)
    )
  });

  for (const device of activeDevices) {
    await executor.update(childDevices).set({ revokedAt: new Date(), pushToken: null }).where(eq(childDevices.id, device.id));
  }

  return activeDevices.length;
}

function getDatabaseErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

export async function childDevicesRoutes(app: FastifyInstance) {
  const childPairRateLimit = {
    max: 8,
    timeWindow: "1 minute"
  } as const;

  app.post("/pair", { config: { rateLimit: childPairRateLimit } }, async (request, reply) => {
    const forwardedFor = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
    const clientKey = forwardedFor || request.ip || "unknown";
    if (isChildPairAttemptBlocked(clientKey)) {
      return sendError(
        reply,
        429,
        "Too many failed pairing attempts. Wait a few minutes and try again.",
        "CHILD_PAIRING_RATE_LIMITED"
      );
    }

    const body = childPairingCodeSchema.parse(request.body);
    const normalizedCode = body.pairingCode.trim().toUpperCase();

    if (!isChildPairingCode(normalizedCode)) {
      recordFailedChildPairAttempt(clientKey);
      return sendError(
        reply,
        400,
        "Child devices pair with a KC- code from a parent. Adult invite codes do not work here.",
        "CHILD_PAIRING_CODE_REQUIRED"
      );
    }

    let stage = "lookup_pairing_code";

    try {
      const pairingCode = await db.query.childPairingCodes.findFirst({
        where: and(eq(childPairingCodes.code, normalizedCode), isNull(childPairingCodes.revokedAt))
      });

      if (!pairingCode || pairingCode.redeemedAt || pairingCode.expiresAt.getTime() < Date.now()) {
        recordFailedChildPairAttempt(clientKey);
        return sendError(reply, 400, "That child pairing code is invalid or expired.", "CHILD_PAIRING_CODE_INVALID");
      }

      stage = "lookup_member";
      const member = await db.query.familyMembers.findFirst({
        where: and(
          eq(familyMembers.id, pairingCode.memberId),
          eq(familyMembers.familyId, pairingCode.familyId),
          eq(familyMembers.role, "child")
        )
      });

      if (!member) {
        recordFailedChildPairAttempt(clientKey);
        return sendError(reply, 400, "That pairing code is not linked to a child profile.", "CHILD_PAIRING_MEMBER_INVALID");
      }

      stage = "lookup_family";
      const family = await db.query.families.findFirst({
        where: eq(families.id, pairingCode.familyId)
      });

      if (!family) {
        recordFailedChildPairAttempt(clientKey);
        return sendError(reply, 404, "Household not found for that pairing code.", "FAMILY_NOT_FOUND");
      }

      const deviceToken = generateChildDeviceToken();

      stage = "pair_device_transaction";
      const result = await db.transaction(async (tx) => {
        await revokeActiveChildDevicesForMember(pairingCode.familyId, pairingCode.memberId, tx);

        const [device] = await tx
          .insert(childDevices)
          .values({
            familyId: pairingCode.familyId,
            memberId: pairingCode.memberId,
            pairingCodeId: pairingCode.id,
            deviceToken
          })
          .returning();

        await tx
          .update(childPairingCodes)
          .set({ redeemedAt: new Date() })
          .where(eq(childPairingCodes.id, pairingCode.id));

        return device;
      });

      clearFailedChildPairAttempts(clientKey);

      stage = "load_star_balance";
      const starBalance = await getMemberStarBalance(member.familyId, member.id);

      const payload = pairChildDeviceResponseSchema.parse({
        deviceToken: result.deviceToken,
        family: {
          id: family.id,
          name: family.name
        },
        member: {
          id: member.id,
          displayName: member.displayName,
          starBalance
        }
      });

      return reply.status(201).send(payload);
    } catch (error) {
      console.error(
        redactForLog({
          scope: "child_device_pair",
          stage,
          pairingCode: normalizedCode,
          clientKey
        })
      );
      logSafeError(error);

      const databaseCode = getDatabaseErrorCode(error);
      if (databaseCode === "42P01" || databaseCode === "42703") {
        return sendError(
          reply,
          503,
          "Child device pairing is not ready on this server yet.",
          "CHILD_PAIRING_NOT_READY"
        );
      }

      return sendError(
        reply,
        500,
        "Child device pairing is temporarily unavailable.",
        "CHILD_PAIRING_UNAVAILABLE"
      );
    }
  });

  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireChildDeviceAuth);

    scoped.get("/me", async (request) => {
      const device = request.childDevice!;
      const member = await db.query.familyMembers.findFirst({
        where: eq(familyMembers.id, device.memberId)
      });
      const family = await db.query.families.findFirst({
        where: eq(families.id, device.familyId)
      });
      const record = await db.query.childDevices.findFirst({
        where: eq(childDevices.id, device.id)
      });

      if (!member || !family || !record) {
        throw new Error("Child device session is missing household context.");
      }

      const starBalance = await getMemberStarBalance(member.familyId, member.id);

      return childDeviceMeResponseSchema.parse({
        device: {
          id: record.id,
          familyId: record.familyId,
          memberId: record.memberId,
          memberName: member.displayName,
          deviceLabel: record.deviceLabel,
          pushToken: record.pushToken,
          pairedAt: record.pairedAt.toISOString(),
          revokedAt: record.revokedAt?.toISOString() ?? null,
          lastSeenAt: record.lastSeenAt?.toISOString() ?? null
        },
        family: {
          id: family.id,
          name: family.name
        },
        member: {
          id: member.id,
          displayName: member.displayName,
          starBalance
        }
      });
    });

    scoped.put("/push-token", async (request, reply) => {
      const device = request.childDevice!;
      const body = childDevicePushTokenSchema.parse(request.body);

      const [updated] = await db
        .update(childDevices)
        .set({ pushToken: body.pushToken })
        .where(eq(childDevices.id, device.id))
        .returning();

      return reply.send({
        device: {
          id: updated.id,
          pushToken: updated.pushToken
        }
      });
    });

    scoped.get("/chores/today", async (request) => {
      const device = request.childDevice!;
      const member = await db.query.familyMembers.findFirst({
        where: eq(familyMembers.id, device.memberId)
      });

      if (!member) {
        throw new Error("Child profile not found.");
      }

      const today = new Date().toISOString().slice(0, 10);
      const rows = await db.query.chores.findMany({
        where: and(eq(chores.familyId, device.familyId), eq(chores.isActive, true), eq(chores.assignedTo, device.memberId)),
        orderBy: desc(chores.createdAt)
      });

      const choresWithStatus = await Promise.all(
        rows.map(async (chore) => {
          const completion = await db.query.choreCompletions.findFirst({
            where: and(
              eq(choreCompletions.choreId, chore.id),
              eq(choreCompletions.memberId, device.memberId),
              eq(choreCompletions.dueDate, today)
            )
          });

          return {
            id: chore.id,
            title: chore.title,
            dueTime: chore.dueTime,
            starsValue: chore.starsValue,
            completedToday: Boolean(completion)
          };
        })
      );

      const starBalance = await getMemberStarBalance(member.familyId, member.id);

      return childDeviceChoresResponseSchema.parse({
        chores: choresWithStatus,
        member: {
          id: member.id,
          displayName: member.displayName,
          starBalance
        }
      });
    });

    scoped.post("/chores/:choreId/complete", async (request, reply) => {
      const device = request.childDevice!;
      const { choreId } = choreParamsSchema.parse(request.params);
      const body = completeChoreSchema.parse(request.body);

      if (body.memberId !== device.memberId) {
        return sendError(reply, 403, "Child devices can only complete their own chores.", "CHILD_DEVICE_SCOPE_DENIED");
      }

      const chore = await db.query.chores.findFirst({
        where: and(
          eq(chores.familyId, device.familyId),
          eq(chores.id, choreId),
          eq(chores.assignedTo, device.memberId)
        )
      });

      if (!chore) {
        return reply.status(404).send({ error: "Chore not found", code: "CHORE_NOT_FOUND" });
      }

      const existingCompletion = await db.query.choreCompletions.findFirst({
        where: and(
          eq(choreCompletions.choreId, choreId),
          eq(choreCompletions.memberId, device.memberId),
          eq(choreCompletions.dueDate, body.dueDate)
        )
      });

      if (existingCompletion) {
        return sendError(
          reply,
          409,
          "This chore was already completed for today.",
          "CHORE_ALREADY_COMPLETED"
        );
      }

      const result = await db.transaction(async (tx) => {
        const [completion] = await tx
          .insert(choreCompletions)
          .values({
            choreId,
            memberId: device.memberId,
            dueDate: body.dueDate,
            notes: body.notes,
            photoUrl: body.photoUrl
          })
          .returning();

        const [reward] = await tx
          .insert(rewards)
          .values({
            familyId: device.familyId,
            memberId: device.memberId,
            stars: chore.starsValue,
            reason: "chore_complete",
            referenceId: completion.id
          })
          .returning();

      return { completion, reward };
    });

    await cancelChoreReminderForDate(device.familyId, choreId);

    return reply.status(201).send(result);
    });

    scoped.post("/unpair", async (request, reply) => {
      const device = request.childDevice!;
      await clearChildDevicePushToken(device.id);
      await db
        .update(childDevices)
        .set({ revokedAt: new Date(), pushToken: null })
        .where(eq(childDevices.id, device.id));

      return reply.send({ revoked: true });
    });
  });
}
