import type { SaveOutcome, SaveOutcomeKind } from "../types";

export function makeSaveOutcome(kind: SaveOutcomeKind, message: string): SaveOutcome {
  return {
    ok: kind === "saved" || kind === "queued" || kind === "local",
    kind,
    message
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
