import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";

import { env } from "./env.js";
import { sendError, sendZodError } from "./lib/http.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { choresRoutes } from "./routes/chores.js";
import { eventsRoutes } from "./routes/events.js";
import { familiesRoutes } from "./routes/families.js";
import { healthRoutes } from "./routes/health.js";
import { listsRoutes } from "./routes/lists.js";
import { mealsRoutes } from "./routes/meals.js";
import { membersRoutes } from "./routes/members.js";
import { recipesRoutes } from "./routes/recipes.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });

  app.register(cors, {
    origin: env.NODE_ENV === "production" ? [env.FRONTEND_URL] : true
  });

  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return sendZodError(reply, error);
    }

    requestLogSafeError(error);
    return sendError(reply, 500, "Something went wrong", "INTERNAL_ERROR");
  });

  app.register(healthRoutes, { prefix: "/api/v1" });
  app.register(aiRoutes, { prefix: "/api/v1/ai" });
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(familiesRoutes, { prefix: "/api/v1/families" });
  app.register(membersRoutes, { prefix: "/api/v1/families/:familyId/members" });
  app.register(eventsRoutes, { prefix: "/api/v1/families/:familyId/events" });
  app.register(choresRoutes, { prefix: "/api/v1/families/:familyId/chores" });
  app.register(listsRoutes, { prefix: "/api/v1/families/:familyId/lists" });
  app.register(mealsRoutes, { prefix: "/api/v1/families/:familyId/meals" });
  app.register(recipesRoutes, { prefix: "/api/v1/families/:familyId/recipes" });

  return app;
}

function requestLogSafeError(error: unknown) {
  if (env.NODE_ENV !== "test") {
    console.error(error);
  }
}
