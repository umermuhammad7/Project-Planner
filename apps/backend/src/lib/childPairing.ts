import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { childPairingAttempts } from "../db/schema.js";

/**
 * Child pairing abuse protection in this repo now has a shared database-backed
 * failure window, plus Fastify's route-level burst limiter on the pairing routes.
 *
 * Production note: the database window works across app replicas, but it is still
 * not a substitute for edge-level throttling against heavy abuse traffic. Keep an
 * API gateway / WAF or Redis-backed rate limiting layer in front of public routes
 * for higher-volume protection.
 */
const pairingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateChildPairingCode() {
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    const offset = randomBytes(1)[0]! % pairingAlphabet.length;
    suffix += pairingAlphabet[offset];
  }

  return `KC-${suffix}`;
}

export function generateChildDeviceToken() {
  return randomBytes(32).toString("hex");
}

export function isChildPairingCode(value: string) {
  return /^KC-[A-Z0-9]{6}$/u.test(value.trim().toUpperCase());
}

export function pairingCodeExpiresAt(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

const PAIR_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PAIR_ATTEMPT_MAX_FAILURES = 12;

export async function isChildPairAttemptBlocked(clientKey: string) {
  const entry = await db.query.childPairingAttempts.findFirst({
    where: eq(childPairingAttempts.clientKey, clientKey)
  });
  if (!entry) {
    return false;
  }

  if (entry.resetAt.getTime() <= Date.now()) {
    await db.delete(childPairingAttempts).where(eq(childPairingAttempts.clientKey, clientKey));
    return false;
  }

  return entry.failureCount >= PAIR_ATTEMPT_MAX_FAILURES;
}

export async function recordFailedChildPairAttempt(clientKey: string) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + PAIR_ATTEMPT_WINDOW_MS);
  const entry = await db.query.childPairingAttempts.findFirst({
    where: eq(childPairingAttempts.clientKey, clientKey)
  });

  if (!entry || entry.resetAt.getTime() <= now.getTime()) {
    await db
      .insert(childPairingAttempts)
      .values({
        clientKey,
        failureCount: 1,
        resetAt,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: childPairingAttempts.clientKey,
        set: {
          failureCount: 1,
          resetAt,
          updatedAt: now
        }
      });
    return;
  }

  await db
    .update(childPairingAttempts)
    .set({
      failureCount: entry.failureCount + 1,
      updatedAt: now
    })
    .where(eq(childPairingAttempts.clientKey, clientKey));
}

export async function clearFailedChildPairAttempts(clientKey: string) {
  await db.delete(childPairingAttempts).where(eq(childPairingAttempts.clientKey, clientKey));
}
