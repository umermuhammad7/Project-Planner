import { AssistantDraft, DraftKind } from "../types";

const groceryWords = ["buy", "grab", "milk", "bread", "eggs", "bananas", "grocery", "store", "target", "costco"];
const choreWords = ["clean", "dishwasher", "laundry", "trash", "homework", "pack", "feed", "water"];
const eventWords = ["practice", "appointment", "pickup", "dropoff", "drop off", "meeting", "game", "dinner", "party"];

const timePattern = /\b([1-9]|1[0-2])(:[0-5][0-9])?\s?(am|pm|a\.m\.|p\.m\.)?\b/i;
const datePattern = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

export function parseFamilyText(rawText: string): AssistantDraft {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const kind = detectKind(lower);
  const time = text.match(timePattern)?.[0];
  const date = text.match(datePattern)?.[0];
  const detailParts = [date, time].filter(Boolean);

  return {
    kind,
    title: titleFromText(text, kind),
    detail: detailParts.length > 0 ? detailParts.join(" at ") : defaultDetail(kind),
    confidence: scoreConfidence(lower, kind, Boolean(time || date)),
    rawText: text
  };
}

export function createDigest(input: {
  events: { title: string; time: string }[];
  chores: { title: string; completed: boolean }[];
  items: { title: string; checked: boolean }[];
}): string {
  const eventLine = input.events.map((event) => `${event.time} ${event.title}`).join(", ");
  const choreLine = input.chores
    .filter((chore) => !chore.completed)
    .map((chore) => chore.title)
    .join(", ");
  const listLine = input.items
    .filter((item) => !item.checked)
    .slice(0, 4)
    .map((item) => item.title)
    .join(", ");

  return [
    `HomeThread today: ${eventLine || "no timed plans"}.`,
    choreLine ? `Still due: ${choreLine}.` : "Chores are clear.",
    listLine ? `Shopping: ${listLine}.` : "Shopping list is clear."
  ].join(" ");
}

function detectKind(lower: string): DraftKind {
  if (groceryWords.some((word) => lower.includes(word))) {
    return "list";
  }

  if (choreWords.some((word) => lower.includes(word))) {
    return "chore";
  }

  if (eventWords.some((word) => lower.includes(word))) {
    return "event";
  }

  return lower.includes("at ") || datePattern.test(lower) ? "event" : "list";
}

function titleFromText(text: string, kind: DraftKind): string {
  const cleaned = text
    .replace(/^please\s+/i, "")
    .replace(/^(can you|could you|remember to|remind me to)\s+/i, "")
    .replace(/[.?!]$/u, "")
    .trim();

  if (cleaned.length <= 48) {
    return cleaned;
  }

  const prefix = kind === "list" ? "Add" : kind === "chore" ? "Task" : "Plan";
  return `${prefix}: ${cleaned.slice(0, 42).trim()}...`;
}

function defaultDetail(kind: DraftKind): string {
  if (kind === "event") {
    return "Needs date or time";
  }

  if (kind === "chore") {
    return "Ready to assign";
  }

  return "Shopping list";
}

function scoreConfidence(lower: string, kind: DraftKind, hasTimeSignal: boolean): number {
  const wordBank = kind === "event" ? eventWords : kind === "chore" ? choreWords : groceryWords;
  const matches = wordBank.filter((word) => lower.includes(word)).length;
  const base = Math.min(0.55 + matches * 0.14, 0.88);
  return Number(Math.min(base + (hasTimeSignal ? 0.08 : 0), 0.96).toFixed(2));
}
