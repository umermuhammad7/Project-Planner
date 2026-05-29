import { assistantAssistRequestSchema, assistantDraftSchema } from "@homethread/shared";

import { completeWithProviderFallback, type ChatMessage } from "./aiProviders.js";

export async function runAssistantAssist(input: unknown) {
  const body = assistantAssistRequestSchema.parse(input);
  const systemPrompt = buildSystemPrompt(body.intent, body.context);
  const userPrompt = body.message.trim();

  const completion = await completeWithProviderFallback([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  if (!completion.ok) {
    return {
      mode: "local" as const,
      provider: null,
      message:
        completion.reason === "No AI providers configured"
          ? "AI assistant is not configured on this backend. HomeThread will use local parsing instead."
          : "AI assistant is temporarily unavailable. HomeThread will use local parsing instead.",
      draft: null
    };
  }

  const parsed = parseAssistantJson(completion.content, userPrompt);

  return {
    mode: "ai" as const,
    provider: completion.provider,
    message: parsed.message,
    draft: parsed.draft
  };
}

function buildSystemPrompt(intent?: string, context?: { familyName?: string; timezone?: string; today?: string; members?: string[]; upcomingEvents?: Array<{ title: string; time: string; dateLabel: string; location?: string | null; assignedTo?: string[] }>; openChores?: Array<{ title: string; dueLabel: string }> }) {
  const intentLine = intentHint(intent);
  const contextLine = buildContextPrompt(context);

  return [
    "You are HomeThread, a calm family planning assistant.",
    "Help turn family text into practical HomeThread actions: events, chores, or grocery/list items.",
    intentLine,
    contextLine,
    "Respond with JSON only using this shape:",
    '{"reply":"short helpful message","draft":{"kind":"event|chore|list","title":"short title","detail":"short detail","confidence":0.0-1,"rawText":"original user text"} | null}',
    "Use draft null when the message is general advice without a single actionable item.",
    "Never include markdown fences or extra keys."
  ]
    .filter(Boolean)
    .join(" ");
}

function intentHint(intent?: string) {
  switch (intent) {
    case "import_text":
      return "Focus on parsing pasted family text into one best event, chore, or list item.";
    case "meal_plan":
      return "Focus on meal planning help and optional grocery ideas. Prefer draft null unless one clear list item is obvious.";
    case "grocery_list":
      return "Focus on grocery list suggestions. Prefer draft kind list when items are named.";
    case "chores":
      return "Focus on turning the request into chores. Prefer draft kind chore.";
    case "day_summary":
      return "Focus on answering questions about today's family schedule using the provided family context. Prefer draft null unless the user clearly asks to create something.";
    default:
      return "Choose the most helpful single draft when possible.";
  }
}

function buildContextPrompt(
  context?: {
    familyName?: string;
    timezone?: string;
    today?: string;
    members?: string[];
    upcomingEvents?: Array<{ title: string; time: string; dateLabel: string; location?: string | null; assignedTo?: string[] }>;
    openChores?: Array<{ title: string; dueLabel: string }>;
  }
) {
  if (!context) {
    return "";
  }

  const parts: string[] = [];

  if (context.familyName) {
    parts.push(`Family: ${context.familyName}.`);
  }

  if (context.today) {
    parts.push(`Today: ${context.today}.`);
  }

  if (context.timezone) {
    parts.push(`Timezone: ${context.timezone}.`);
  }

  if (context.members?.length) {
    parts.push(`Members: ${context.members.join(", ")}.`);
  }

  if (context.upcomingEvents?.length) {
    const events = context.upcomingEvents
      .map((event) => {
        const assigned = event.assignedTo?.length ? ` for ${event.assignedTo.join(", ")}` : "";
        const location = event.location ? ` at ${event.location}` : "";
        return `${event.dateLabel} ${event.time}: ${event.title}${assigned}${location}`;
      })
      .join("; ");
    parts.push(`Upcoming events: ${events}.`);
  }

  if (context.openChores?.length) {
    const chores = context.openChores.map((chore) => `${chore.title} (${chore.dueLabel})`).join("; ");
    parts.push(`Open chores: ${chores}.`);
  }

  return parts.join(" ");
}

function parseAssistantJson(content: string, rawText: string) {
  const jsonText = extractJsonObject(content);
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch {
    return {
      message: content.trim(),
      draft: null
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      message: content.trim(),
      draft: null
    };
  }

  const record = payload as Record<string, unknown>;
  const message = typeof record.reply === "string" ? record.reply.trim() : content.trim();
  const draftCandidate = record.draft;

  if (!draftCandidate || typeof draftCandidate !== "object") {
    return { message, draft: null };
  }

  const draftRecord = draftCandidate as Record<string, unknown>;
  const parsedDraft = assistantDraftSchema.safeParse({
    kind: draftRecord.kind,
    title: draftRecord.title,
    detail: draftRecord.detail,
    confidence: draftRecord.confidence,
    rawText: typeof draftRecord.rawText === "string" ? draftRecord.rawText : rawText
  });

  if (!parsedDraft.success) {
    return { message, draft: null };
  }

  return {
    message,
    draft: parsedDraft.data
  };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}
