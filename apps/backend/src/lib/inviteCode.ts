import { randomBytes } from "node:crypto";

const MAX_ATTEMPTS = 5;

export function generateFamilyInviteCode() {
  return randomBytes(4).toString("hex");
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505"
  );
}

/**
 * Invite codes are unique and randomly generated, so a fresh collision is possible
 * as the number of households grows. Retry with a new code instead of surfacing a
 * raw DB constraint error to the admin trying to create/regenerate one.
 */
export async function withUniqueInviteCodeRetry<T>(attempt: (inviteCode: string) => Promise<T>): Promise<T> {
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    try {
      return await attempt(generateFamilyInviteCode());
    } catch (error) {
      if (!isUniqueViolation(error) || i === MAX_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unreachable");
}
