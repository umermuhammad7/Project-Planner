import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../env.js";

const ALGORITHM = "aes-256-gcm";

export function encryptCalendarToken(token: string) {
  const key = requireCalendarTokenKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

export function decryptCalendarToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  if (!token.startsWith("v1.")) {
    return token;
  }

  const key = requireCalendarTokenKey();
  const [, encodedIv, encodedTag, encodedCiphertext] = token.split(".");
  if (!encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Stored calendar token is malformed.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, fromBase64Url(encodedIv));
  decipher.setAuthTag(fromBase64Url(encodedTag));
  const decrypted = Buffer.concat([
    decipher.update(fromBase64Url(encodedCiphertext)),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

function requireCalendarTokenKey() {
  const raw = env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const normalized = raw.replace(/-/gu, "+").replace(/_/gu, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  const candidates = [
    tryDecode(() => Buffer.from(raw, "hex")),
    tryDecode(() => Buffer.from(`${normalized}${padding}`, "base64")),
    Buffer.from(raw, "utf8")
  ].filter((candidate): candidate is Buffer => Boolean(candidate));

  const key = candidates.find((candidate) => candidate.length === 32);
  if (!key) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return key;
}

function tryDecode(factory: () => Buffer) {
  try {
    return factory();
  } catch {
    return null;
  }
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
