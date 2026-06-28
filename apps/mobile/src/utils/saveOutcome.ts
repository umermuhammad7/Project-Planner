import type { SaveOutcome, SaveOutcomeField, SaveOutcomeKind } from "../types";

export function makeSaveOutcome(
  kind: SaveOutcomeKind,
  message: string,
  invalidField?: SaveOutcomeField
): SaveOutcome {
  return {
    ok: kind === "saved" || kind === "queued" || kind === "local",
    kind,
    message,
    invalidField
  };
}

export function feedbackToneForOutcome(kind: SaveOutcomeKind): "success" | "error" | "info" {
  if (kind === "failed") {
    return "error";
  }

  if (kind === "queued" || kind === "local") {
    return "info";
  }

  return "success";
}
