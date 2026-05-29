import { FastifyInstance } from "fastify";

import { getAssistantProviderStatus } from "../env.js";
import { runAssistantAssist } from "../lib/assistant.js";
import { runMealSuggest } from "../lib/mealSuggest.js";
import { runRecipeImport } from "../lib/recipeImport.js";
import { requireAuth } from "../plugins/auth.js";

export async function aiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/status", async () => {
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

  app.post("/assist", async (request) => {
    return runAssistantAssist(request.body);
  });

  app.post("/meal-suggest", async (request) => {
    return runMealSuggest(request.body);
  });

  app.post("/recipe-import", async (request) => {
    return runRecipeImport(request.body);
  });
}
