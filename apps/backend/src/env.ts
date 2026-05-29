import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/homethread"),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().default("exp://homethread"),
  DEV_AUTH_TOKEN: z.string().min(1).default("homethread-dev-token"),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY_1: z.string().optional(),
  GROQ_API_KEY_2: z.string().optional(),
  GROQ_API_KEY_3: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile")
});

export const env = envSchema.parse(process.env);

export function getAssistantProviderStatus() {
  const groqKeys = [env.GROQ_API_KEY_1, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3].filter((key) =>
    Boolean(key?.trim())
  );

  return {
    openaiConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    groqKeysConfigured: groqKeys.length
  };
}
