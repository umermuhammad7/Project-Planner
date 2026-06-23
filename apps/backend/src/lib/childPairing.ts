import { randomBytes } from "node:crypto";

/**
 * Child pairing abuse protection in this repo is process-local:
 * - Fastify route rate limit on POST /child-devices/pair
 * - In-memory failed-attempt counter per client IP
 *
 * Production requirement (multi-instance): add shared rate limiting at the edge
 * (API gateway / WAF) or Redis-backed counters. Without that, each server process
 * tracks failures independently.
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

const failedPairAttempts = new Map<string, { count: number; resetAt: number }>();

const PAIR_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PAIR_ATTEMPT_MAX_FAILURES = 12;

export function isChildPairAttemptBlocked(clientKey: string) {
  const entry = failedPairAttempts.get(clientKey);
  if (!entry) {
    return false;
  }

  if (entry.resetAt <= Date.now()) {
    failedPairAttempts.delete(clientKey);
    return false;
  }

  return entry.count >= PAIR_ATTEMPT_MAX_FAILURES;
}

export function recordFailedChildPairAttempt(clientKey: string) {
  const now = Date.now();
  const entry = failedPairAttempts.get(clientKey);

  if (!entry || entry.resetAt <= now) {
    failedPairAttempts.set(clientKey, { count: 1, resetAt: now + PAIR_ATTEMPT_WINDOW_MS });
    return;
  }

  entry.count += 1;
}

export function clearFailedChildPairAttempts(clientKey: string) {
  failedPairAttempts.delete(clientKey);
}
