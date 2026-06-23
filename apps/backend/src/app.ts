import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { FastifyError } from "fastify";
import { ZodError } from "zod";

import { env, getAllowedFrontendOrigins } from "./env.js";
import { sendError, sendZodError } from "./lib/http.js";
import { logSafeError } from "./lib/redactLog.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { choresRoutes } from "./routes/chores.js";
import { eventsRoutes } from "./routes/events.js";
import { familiesRoutes } from "./routes/families.js";
import { healthRoutes } from "./routes/health.js";
import { insightsRoutes } from "./routes/insights.js";
import { listsRoutes } from "./routes/lists.js";
import { mealsRoutes } from "./routes/meals.js";
import { membersRoutes } from "./routes/members.js";
import { calendarSyncRoutes } from "./routes/calendarSync.js";
import { childDeviceAdminRoutes } from "./routes/childDeviceAdmin.js";
import { childDevicesRoutes } from "./routes/childDevices.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { recipesRoutes } from "./routes/recipes.js";
import { subscriptionsRoutes } from "./routes/subscriptions.js";
import { webhookRoutes } from "./routes/webhooks.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    bodyLimit: 1_048_576,
    trustProxy: true
  });

  const allowedOrigins = new Set(getAllowedFrontendOrigins());

  app.register(cors, {
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin(origin, callback) {
      if (env.NODE_ENV === "test") {
        callback(null, true);
        return;
      }

      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    }
  });

  app.register(helmet, {
    contentSecurityPolicy: false
  });

  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    errorResponseBuilder: function (_request, context) {
      const retryAfterMs = Number(context.after) || 0;
      return {
        error: `Too many requests. Try again in ${Math.max(1, Math.ceil(retryAfterMs / 1000))} seconds.`,
        code: "RATE_LIMITED"
      };
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return sendZodError(reply, error);
    }

    const fastifyError = error as Partial<FastifyError>;
    if (typeof fastifyError.statusCode === "number" && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
      return sendError(
        reply,
        fastifyError.statusCode,
        fastifyError.message || "Request could not be processed.",
        fastifyError.code || "BAD_REQUEST"
      );
    }

    logSafeError(error);
    return sendError(reply, 500, "Something went wrong", "INTERNAL_ERROR");
  });

  app.register(healthRoutes, { prefix: "/api/v1" });
  app.register(aiRoutes, { prefix: "/api/v1/ai" });
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(familiesRoutes, { prefix: "/api/v1/families" });
  app.register(childDeviceAdminRoutes, { prefix: "/api/v1/families/:familyId" });
  app.register(membersRoutes, { prefix: "/api/v1/families/:familyId/members" });
  app.register(eventsRoutes, { prefix: "/api/v1/families/:familyId/events" });
  app.register(choresRoutes, { prefix: "/api/v1/families/:familyId/chores" });
  app.register(listsRoutes, { prefix: "/api/v1/families/:familyId/lists" });
  app.register(mealsRoutes, { prefix: "/api/v1/families/:familyId/meals" });
  app.register(recipesRoutes, { prefix: "/api/v1/families/:familyId/recipes" });
  app.register(insightsRoutes, { prefix: "/api/v1/families/:familyId/insights" });
  app.register(calendarSyncRoutes, { prefix: "/api/v1/calendar-sync" });
  app.register(childDevicesRoutes, { prefix: "/api/v1/child-devices" });
  app.register(notificationsRoutes, { prefix: "/api/v1/notifications" });
  app.register(subscriptionsRoutes, { prefix: "/api/v1/subscriptions" });
  app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });

  return app;
}
