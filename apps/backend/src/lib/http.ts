import { FastifyReply } from "fastify";
import { ZodError, ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function parseQuery<T>(schema: ZodSchema<T>, query: unknown): T {
  return schema.parse(query);
}

export function sendError(reply: FastifyReply, statusCode: number, error: string, code: string) {
  return reply.status(statusCode).send({ error, code });
}

export function sendZodError(reply: FastifyReply, error: ZodError) {
  return sendError(reply, 400, error.issues.map((issue) => issue.message).join("; "), "VALIDATION_ERROR");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
