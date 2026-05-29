import {
  assistantMealSuggestRequestSchema,
  assistantMealSuggestionItemSchema
} from "@homethread/shared";

import { completeWithProviderFallback, type ChatMessage } from "./aiProviders.js";

export async function runMealSuggest(input: unknown) {
  const body = assistantMealSuggestRequestSchema.parse(input);
  const dinnerCount = body.dinnerCount ?? 5;
  const userPrompt = body.message.trim();

  const completion = await completeWithProviderFallback([
    { role: "system", content: buildMealSuggestSystemPrompt(dinnerCount) },
    { role: "user", content: userPrompt }
  ]);

  if (!completion.ok) {
    return {
      mode: "local" as const,
      provider: null,
      message:
        completion.reason === "No AI providers configured"
          ? "AI meal suggestions are not configured on this backend."
          : "AI meal suggestions are temporarily unavailable.",
      suggestions: null
    };
  }

  const parsed = parseMealSuggestJson(completion.content);

  return {
    mode: "ai" as const,
    provider: completion.provider,
    message: parsed.message,
    suggestions: parsed.suggestions
  };
}

function buildMealSuggestSystemPrompt(dinnerCount: number) {
  return [
    "You are HomeThread, a calm family meal-planning assistant.",
    `Suggest up to ${dinnerCount} practical family dinners for the week.`,
    "Use dayOfWeek 0=Monday through 6=Sunday. Prefer dinner mealType unless the user asks otherwise.",
    "Respect dietary constraints mentioned by the user.",
    "Respond with JSON only using this shape:",
    '{"reply":"short helpful summary","suggestions":[{"dayOfWeek":0,"mealType":"dinner","title":"Meal name","notes":"optional short note"}]}',
    "Include 1 suggestion per day when possible. Do not invent recipes with long ingredient lists.",
    "Never include markdown fences or extra keys."
  ].join(" ");
}

function parseMealSuggestJson(content: string) {
  const jsonText = extractJsonObject(content);
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch {
    return {
      message: content.trim(),
      suggestions: null
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      message: content.trim(),
      suggestions: null
    };
  }

  const record = payload as Record<string, unknown>;
  const message = typeof record.reply === "string" ? record.reply.trim() : content.trim();
  const rawSuggestions = record.suggestions;

  if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) {
    return { message, suggestions: null };
  }

  const suggestions = rawSuggestions
    .map((entry) => assistantMealSuggestionItemSchema.safeParse(entry))
    .filter((result) => result.success)
    .map((result) => result.data);

  return {
    message,
    suggestions: suggestions.length > 0 ? suggestions : null
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
