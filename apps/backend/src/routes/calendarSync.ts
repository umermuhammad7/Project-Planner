import {
  calendarConnectAttemptResponseSchema,
  calendarSyncNowBodySchema,
  calendarSyncNowResponseSchema,
  uuidSchema
} from "@homethread/shared";
import { and, eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { calendarConnections } from "../db/schema.js";
import { getCalendarSyncStatus, getGoogleOAuthConfig } from "../env.js";
import { syncGoogleConnection } from "../lib/calendarImport.js";
import { encryptCalendarToken } from "../lib/calendarTokenCrypto.js";
import { sendError } from "../lib/http.js";
import { logSafeError } from "../lib/redactLog.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyQuerySchema = z.object({
  familyId: uuidSchema
});

const googleCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional()
});

type CalendarOAuthState = {
  familyId: string;
  userId: string;
  issuedAt: number;
};

const stateMaxAgeMs = 15 * 60 * 1000;

export async function calendarSyncRoutes(app: FastifyInstance) {
  const calendarRateLimit = {
    max: 10,
    timeWindow: "1 minute"
  } as const;

  app.get("/status", { preHandler: requireAuth, config: { rateLimit: calendarRateLimit } }, async () => {
    return getCalendarSyncStatus();
  });

  app.get("/connections", { preHandler: requireAuth, config: { rateLimit: calendarRateLimit } }, async (request, reply) => {
    const { familyId } = familyQuerySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const rows = await db.query.calendarConnections.findMany({
      where: eq(calendarConnections.familyId, familyId)
    });

    return {
      connections: rows.map((row) => ({
        id: row.id,
        provider: row.provider as "google" | "apple" | "outlook",
        externalCalendarId: row.externalCalendarId,
        isActive: row.isActive,
        lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null
      }))
    };
  });

  app.post("/google/connect", { preHandler: requireAuth, config: { rateLimit: calendarRateLimit } }, async (request, reply) => {
    const { familyId } = familyQuerySchema.parse(request.body);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const oauth = getGoogleOAuthConfig();
    if (!oauth) {
      const payload = calendarConnectAttemptResponseSchema.parse({
        ok: false,
        message: "Google Calendar OAuth is not configured on this server."
      });
      return reply.status(501).send(payload);
    }

    const redirectUri = resolveGoogleRedirectUri(request, oauth.redirectUri, oauth.hasExplicitRedirectUri);

    const state = signCalendarState(
      {
        familyId,
        userId: request.currentUser!.id,
        issuedAt: Date.now()
      },
      oauth.clientSecret
    );

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", oauth.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", oauth.scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const payload = calendarConnectAttemptResponseSchema.parse({
      ok: true,
      message: "Open the Google consent page to connect your calendar, then return to HomeThread and refresh status.",
      authUrl: authUrl.toString()
    });

    return reply.send(payload);
  });

  app.get("/google/callback", async (request, reply) => {
    const query = googleCallbackQuerySchema.parse(request.query);
    const oauth = getGoogleOAuthConfig();

    if (!oauth) {
      return reply
        .status(500)
        .type("text/html")
        .send(renderCalendarCallbackPage("Google Calendar is not configured on this server yet."));
    }

    if (query.error) {
      return reply
        .status(400)
        .type("text/html")
        .send(
          renderCalendarCallbackPage(
            `Google Calendar connect was cancelled or failed: ${query.error_description ?? query.error}`
          )
        );
    }

    if (!query.code || !query.state) {
      return reply
        .status(400)
        .type("text/html")
        .send(renderCalendarCallbackPage("Google Calendar callback is missing the required code or state."));
    }

    const state = verifyCalendarState(query.state, oauth.clientSecret);
    if (!state) {
      return reply
        .status(400)
        .type("text/html")
        .send(renderCalendarCallbackPage("Google Calendar connect could not verify the sign-in state."));
    }

    if (Date.now() - state.issuedAt > stateMaxAgeMs) {
      return reply
        .status(400)
        .type("text/html")
        .send(renderCalendarCallbackPage("Google Calendar connect expired. Start the connection again from HomeThread."));
    }

    try {
      const redirectUri = resolveGoogleRedirectUri(request, oauth.redirectUri, oauth.hasExplicitRedirectUri);
      const tokenData = await exchangeGoogleCode({
        code: query.code,
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret,
        redirectUri
      });

      const primaryCalendarId = await fetchPrimaryCalendarId(tokenData.accessToken);
      await upsertGoogleConnection({
        familyId: state.familyId,
        userId: state.userId,
        externalCalendarId: primaryCalendarId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken ?? null,
        expiresIn: tokenData.expiresIn
      });

      return reply
        .type("text/html")
        .send(
          renderCalendarCallbackPage(
            "Google Calendar connected. Return to HomeThread and refresh calendar status."
          )
        );
    } catch (error) {
      logSafeError(error);
      return reply
        .status(502)
        .type("text/html")
        .send(
          renderCalendarCallbackPage(
            "Google Calendar could not be connected. Return to HomeThread and try again."
          )
        );
    }
  });

  app.post("/sync", { preHandler: requireAuth, config: { rateLimit: calendarRateLimit } }, async (request, reply) => {
    const body = calendarSyncNowBodySchema.parse(request.body);
    const membership = await requireFamilyMember(request, reply, body.familyId);
    if (!membership) return;

    const filters = [
      eq(calendarConnections.familyId, body.familyId),
      eq(calendarConnections.isActive, true)
    ];
    if (body.connectionId) {
      filters.push(eq(calendarConnections.id, body.connectionId));
    }

    const rows = await db.query.calendarConnections.findMany({
      where: and(...filters)
    });

    if (rows.length === 0) {
      return sendError(reply, 404, "No active calendar connections found for this family.", "CALENDAR_CONNECTION_NOT_FOUND");
    }

    const oauth = getGoogleOAuthConfig();
    const results = [];

    for (const connection of rows) {
      try {
        if (connection.provider === "google") {
          if (!oauth) {
            results.push({
              connectionId: connection.id,
              provider: connection.provider as "google",
              added: 0,
              skipped: 0,
              failed: 0,
              message: "Google OAuth is not configured on this server."
            });
            continue;
          }

          if (!connection.accessToken && !connection.refreshToken) {
            results.push({
              connectionId: connection.id,
              provider: "google",
              added: 0,
              skipped: 0,
              failed: 0,
              message: "Google Calendar is connected without usable tokens. Reconnect Google Calendar."
            });
            continue;
          }

          const counts = await syncGoogleConnection({
            connection,
            userId: request.currentUser!.id,
            oauth
          });

          results.push({
            connectionId: connection.id,
            provider: "google",
            ...counts
          });
          continue;
        }

        results.push({
          connectionId: connection.id,
          provider: connection.provider as "apple" | "outlook",
          added: 0,
          skipped: 0,
          failed: 0,
          message: `${connection.provider} calendar sync is not implemented in this build.`
        });
      } catch (error) {
        logSafeError(error);
        results.push({
          connectionId: connection.id,
          provider: connection.provider as "google" | "apple" | "outlook" | "ical",
          added: 0,
          skipped: 0,
          failed: 1,
          message: "Calendar sync failed for this connection."
        });
      }
    }

    const payload = calendarSyncNowResponseSchema.parse({
      ok: results.some((result) => result.added > 0 || result.skipped > 0),
      message:
        "Manual calendar sync finished. Duplicate external event IDs were skipped; remote edits and deletions are not reconciled yet.",
      results
    });

    return reply.send(payload);
  });
}

function resolveGoogleRedirectUri(
  request: { headers: Record<string, string | string[] | undefined> },
  configuredRedirectUri: string,
  hasExplicitRedirectUri: boolean
) {
  try {
    if (hasExplicitRedirectUri) {
      return configuredRedirectUri;
    }

    const forwardedHost = request.headers["x-forwarded-host"];
    const forwardedProto = request.headers["x-forwarded-proto"];
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto ?? "https";

    if (!host) {
      return configuredRedirectUri;
    }

    return new URL("/api/v1/calendar-sync/google/callback", `${proto}://${host}`).toString();
  } catch {
    return configuredRedirectUri;
  }
}

function signCalendarState(payload: CalendarOAuthState, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyCalendarState(value: string, secret: string): CalendarOAuthState | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return z
      .object({
        familyId: uuidSchema,
        userId: uuidSchema,
        issuedAt: z.number().int().nonnegative()
      })
      .parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code"
    })
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || typeof payload.expires_in !== "number") {
    throw new Error(payload.error_description ?? payload.error ?? "Google token exchange failed.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in
  };
}

async function fetchPrimaryCalendarId(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    items?: Array<{ id?: string; primary?: boolean }>;
  };

  const primary = payload.items?.find((item) => item.primary && item.id);
  return primary?.id ?? null;
}

async function upsertGoogleConnection(input: {
  familyId: string;
  userId: string;
  externalCalendarId: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}) {
  const tokenExpiresAt = new Date(Date.now() + input.expiresIn * 1000);
  const existing = await db.query.calendarConnections.findFirst({
    where: and(
      eq(calendarConnections.familyId, input.familyId),
      eq(calendarConnections.userId, input.userId),
      eq(calendarConnections.provider, "google")
    )
  });

  if (existing) {
    await db
      .update(calendarConnections)
      .set({
        externalCalendarId: input.externalCalendarId,
        accessToken: encryptCalendarToken(input.accessToken),
        refreshToken: input.refreshToken
          ? encryptCalendarToken(input.refreshToken)
          : existing.refreshToken,
        tokenExpiresAt,
        isActive: true
      })
      .where(eq(calendarConnections.id, existing.id));
    return;
  }

  await db.insert(calendarConnections).values({
    familyId: input.familyId,
    userId: input.userId,
    provider: "google",
    externalCalendarId: input.externalCalendarId,
    accessToken: encryptCalendarToken(input.accessToken),
    refreshToken: input.refreshToken ? encryptCalendarToken(input.refreshToken) : null,
    tokenExpiresAt,
    isActive: true
  });
}

function renderCalendarCallbackPage(message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HomeThread Calendar Sync</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f6f6fb; color: #162033; margin: 0; }
      main { max-width: 560px; margin: 80px auto; background: white; border: 1px solid #d9deeb; border-radius: 18px; padding: 28px; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { line-height: 1.5; color: #4b5668; }
    </style>
  </head>
  <body>
    <main>
      <h1>HomeThread</h1>
      <p>${escapeHtml(message)}</p>
      <p>You can close this tab and return to the app.</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
