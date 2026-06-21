import { FastifyInstance } from "fastify";

import { pool } from "../db/client.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    let dbStatus: "ok" | "error" = "ok";

    try {
      await pool.query("SELECT 1");
    } catch {
      dbStatus = "error";
    }

    const payload = {
      status: dbStatus === "ok" ? ("ok" as const) : ("degraded" as const),
      service: "homethread-backend",
      db: dbStatus
    };

    if (dbStatus === "error") {
      return reply.status(503).send(payload);
    }

    return payload;
  });
}
