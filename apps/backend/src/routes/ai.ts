import { FastifyInstance } from "fastify";

import { getAssistantProviderStatus } from "../env.js";
import { runAssistantAssist } from "../lib/assistant.js";
import { runMealSuggest } from "../lib/mealSuggest.js";
import { runRecipeImport } from "../lib/recipeImport.js";
import { requireAuth } from "../plugins/auth.js";
import { requirePlus } from "../plugins/requirePlus.js";

export async function aiRoutes(app: FastifyInstance) {
  const aiRateLimit = {
    max: 20,
    timeWindow: "1 minute"
  } as const;

  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requirePlus);

  app.get("/status", { config: { rateLimit: aiRateLimit } }, async () => {
    const status = getAssistantProviderStatus();
    return {
      configured: status.openaiConfigured || status.groqKeysConfigured > 0,
      providers: {
        openai: status.openaiConfigured,
        groqKeys: status.groqKeysConfigured
      },
      streaming: false
    };
  });

  app.post("/assist", { config: { rateLimit: aiRateLimit } }, async (request) => {
    return runAssistantAssist(request.body);
  });

  app.post("/meal-suggest", { config: { rateLimit: aiRateLimit } }, async (request) => {
    return runMealSuggest(request.body);
  });

  app.post("/recipe-import", { config: { rateLimit: aiRateLimit } }, async (request) => {
    return runRecipeImport(request.body);
  });
}
