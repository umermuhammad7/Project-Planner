import { createRecipeSchema, recipeImportRequestSchema } from "@homethread/shared";

import { completeWithProviderFallback, type ChatMessage } from "./aiProviders.js";

export async function runRecipeImport(input: unknown) {
  const body = recipeImportRequestSchema.parse(input);

  if (body.source === "url") {
    return {
      mode: "local" as const,
      provider: null,
      message:
        "HomeThread does not fetch recipe web pages in this build. Copy the recipe text and use paste import instead.",
      source: "url" as const,
      recipe: null
    };
  }

  const text = body.text.trim();
  const completion = await completeWithProviderFallback([
    { role: "system", content: buildRecipeImportSystemPrompt() },
    { role: "user", content: text }
  ]);

  if (!completion.ok) {
    const localRecipe = parseRecipeTextLocally(text);
    return {
      mode: "local" as const,
      provider: null,
      message: localRecipe
        ? "AI recipe import is unavailable. HomeThread used a simple local parse — review before saving."
        : "AI recipe import is unavailable. Add a title on the first line and ingredients on the following lines.",
      source: "text" as const,
      recipe: localRecipe
    };
  }

  const parsed = parseRecipeImportJson(completion.content);

  return {
    mode: "ai" as const,
    provider: completion.provider,
    message: parsed.message,
    source: "text" as const,
    recipe: parsed.recipe
  };
}

function buildRecipeImportSystemPrompt() {
  return [
    "You are HomeThread, a family recipe assistant.",
    "Parse pasted recipe text into structured fields.",
    "Respond with JSON only using this shape:",
    '{"reply":"short note about what you parsed","recipe":{"title":"string","description":"optional string or null","ingredients":[{"name":"string","amount":"optional","unit":"optional"}],"instructions":[{"step":1,"text":"string"}],"prepTimeMinutes":null,"cookTimeMinutes":null,"servings":null}}',
    "Use recipe null if the text is not a recipe or is too incomplete.",
    "Keep ingredient names practical. Do not invent ingredients that are not in the text.",
    "Never include markdown fences or extra keys."
  ].join(" ");
}

function parseRecipeImportJson(content: string) {
  const jsonText = extractJsonObject(content);
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch {
    return {
      message: content.trim(),
      recipe: null
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      message: content.trim(),
      recipe: null
    };
  }

  const record = payload as Record<string, unknown>;
  const message = typeof record.reply === "string" ? record.reply.trim() : content.trim();
  const recipeCandidate = record.recipe;

  if (!recipeCandidate || typeof recipeCandidate !== "object") {
    return { message, recipe: null };
  }

  const parsedRecipe = createRecipeSchema.safeParse(recipeCandidate);
  if (!parsedRecipe.success) {
    return {
      message: `${message} (Could not validate parsed recipe fields.)`,
      recipe: null
    };
  }

  return {
    message,
    recipe: parsedRecipe.data
  };
}

export function parseRecipeTextLocally(text: string) {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const title = lines[0];
  const ingredients: Array<{ name: string; amount?: string | null; unit?: string | null }> = [];

  for (const line of lines.slice(1)) {
    if (/^instructions?\b[:\s]/iu.test(line)) {
      break;
    }

    if (/^ingredients?\b[:\s]/iu.test(line)) {
      continue;
    }

    for (const part of line.split(",")) {
      const name = part.trim();
      if (name) {
        ingredients.push({ name });
      }
    }
  }

  const parsed = createRecipeSchema.safeParse({
    title,
    ingredients
  });

  return parsed.success ? parsed.data : null;
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
