import { and, eq, isNull } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";

import { db } from "../db/client.js";
import { childDevices } from "../db/schema.js";
import { sendError } from "../lib/http.js";

export async function requireChildDeviceAuth(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("ChildDevice ")
    ? authorization.slice("ChildDevice ".length).trim()
    : undefined;

  if (!token) {
    return sendError(
      reply,
      401,
      "Missing child device token. Use the ChildDevice authorization scheme.",
      "CHILD_DEVICE_AUTH_REQUIRED"
    );
  }

  const device = await db.query.childDevices.findFirst({
    where: and(eq(childDevices.deviceToken, token), isNull(childDevices.revokedAt))
  });

  if (!device) {
    return sendError(reply, 401, "Child device session is invalid or revoked", "CHILD_DEVICE_AUTH_INVALID");
  }

  await db
    .update(childDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(childDevices.id, device.id));

  request.childDevice = {
    id: device.id,
    familyId: device.familyId,
    memberId: device.memberId,
    deviceToken: device.deviceToken
  };
}
