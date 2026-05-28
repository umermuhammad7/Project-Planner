import { createClient } from "@supabase/supabase-js";
import { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../env.js";
import { sendError } from "../lib/http.js";

const supabase =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false
        }
      })
    : null;

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;

  if (!token) {
    return sendError(reply, 401, "Missing bearer token", "AUTH_REQUIRED");
  }

  if (!supabase) {
    if (env.NODE_ENV === "production") {
      return sendError(reply, 500, "Supabase is not configured", "AUTH_NOT_CONFIGURED");
    }

    request.currentUser = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "dev@homethread.local"
    };
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.email) {
    return sendError(reply, 401, "Invalid bearer token", "AUTH_INVALID");
  }

  request.currentUser = {
    id: data.user.id,
    email: data.user.email
  };
}

export async function deleteSupabaseUser(userId: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}
