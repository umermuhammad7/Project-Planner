import { childDevicesListResponseSchema, childPairingCodeResponseSchema, childPairingCodesListResponseSchema, uuidSchema } from "@homethread/shared";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { childDevices, childPairingCodes, familyMembers } from "../db/schema.js";
import { generateChildPairingCode, pairingCodeExpiresAt } from "../lib/childPairing.js";
import { sendError } from "../lib/http.js";
import { clearChildDevicePushToken } from "../lib/pushNotifications.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

const memberParamsSchema = familyParamsSchema.extend({
  memberId: uuidSchema
});

const deviceParamsSchema = familyParamsSchema.extend({
  deviceId: uuidSchema
});

export async function childDeviceAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/members/:memberId/child-pairing-code", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId, memberId } = memberParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const member = await db.query.familyMembers.findFirst({
      where: and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, familyId))
    });

    if (!member || member.role !== "child") {
      return sendError(
        reply,
        400,
        "Pairing codes can only be created for child profiles.",
        "CHILD_PAIRING_MEMBER_REQUIRED"
      );
    }

    await db
      .update(childPairingCodes)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(childPairingCodes.familyId, familyId),
          eq(childPairingCodes.memberId, memberId),
          isNull(childPairingCodes.redeemedAt),
          isNull(childPairingCodes.revokedAt)
        )
      );

    const expiresAt = pairingCodeExpiresAt();
    const [pairingCode] = await db
      .insert(childPairingCodes)
      .values({
        familyId,
        memberId,
        code: generateChildPairingCode(),
        createdBy: currentUser.id,
        expiresAt
      })
      .returning();

    return reply.status(201).send(
      childPairingCodeResponseSchema.parse({
        pairingCode: pairingCode.code,
        expiresAt: pairingCode.expiresAt.toISOString(),
        memberId: member.id,
        memberName: member.displayName
      })
    );
  });

  app.get("/child-pairing-codes", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const now = new Date();
    const pairingCodes = await db.query.childPairingCodes.findMany({
      where: and(
        eq(childPairingCodes.familyId, familyId),
        isNull(childPairingCodes.redeemedAt),
        isNull(childPairingCodes.revokedAt),
        gt(childPairingCodes.expiresAt, now)
      ),
      orderBy: desc(childPairingCodes.createdAt)
    });

    const members = await db.query.familyMembers.findMany({
      where: eq(familyMembers.familyId, familyId)
    });
    const memberNames = new Map(members.map((member) => [member.id, member.displayName]));

    return childPairingCodesListResponseSchema.parse({
      pairingCodes: pairingCodes.map((entry) => ({
        pairingCode: entry.code,
        expiresAt: entry.expiresAt.toISOString(),
        memberId: entry.memberId,
        memberName: memberNames.get(entry.memberId) ?? "Child"
      }))
    });
  });

  app.get("/child-devices", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const devices = await db.query.childDevices.findMany({
      where: eq(childDevices.familyId, familyId),
      orderBy: desc(childDevices.pairedAt)
    });

    const memberNames = new Map(
      (
        await db.query.familyMembers.findMany({
          where: eq(familyMembers.familyId, familyId)
        })
      ).map((member) => [member.id, member.displayName])
    );

    return childDevicesListResponseSchema.parse({
      devices: devices.map((device) => ({
        id: device.id,
        familyId: device.familyId,
        memberId: device.memberId,
        memberName: memberNames.get(device.memberId) ?? "Child",
        deviceLabel: device.deviceLabel,
        pushToken: device.pushToken,
        pairedAt: device.pairedAt.toISOString(),
        revokedAt: device.revokedAt?.toISOString() ?? null,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null
      }))
    });
  });

  app.delete("/child-devices/:deviceId", async (request, reply) => {
    const { familyId, deviceId } = deviceParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const device = await db.query.childDevices.findFirst({
      where: and(eq(childDevices.id, deviceId), eq(childDevices.familyId, familyId))
    });

    if (!device) {
      return reply.status(404).send({ error: "Child device not found", code: "CHILD_DEVICE_NOT_FOUND" });
    }

    await clearChildDevicePushToken(device.id);
    await db
      .update(childDevices)
      .set({ revokedAt: new Date(), pushToken: null })
      .where(eq(childDevices.id, device.id));

    return reply.send({ revoked: true });
  });
}
