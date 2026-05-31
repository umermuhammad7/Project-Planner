import ICAL from "ical.js";
import { and, eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { calendarConnections, events } from "../db/schema.js";
import { decryptCalendarToken, encryptCalendarToken } from "./calendarTokenCrypto.js";

export type ImportedCalendarEvent = {
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
};

export type CalendarSyncCounts = {
  added: number;
  skipped: number;
  failed: number;
};

type CalendarConnectionRow = typeof calendarConnections.$inferSelect;

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export function parseIcalFeed(icsText: string, now = new Date()): ImportedCalendarEvent[] {
  const parsed = ICAL.parse(icsText);
  const root = new ICAL.Component(parsed);
  const imported: ImportedCalendarEvent[] = [];

  for (const vevent of root.getAllSubcomponents("vevent")) {
    try {
      const event = new ICAL.Event(vevent);
      const externalId = event.uid?.trim();
      const title = event.summary?.trim();

      if (!externalId || !title || !event.startDate) {
        continue;
      }

      const startAt = event.startDate.toJSDate();
      if (startAt.getTime() < now.getTime()) {
        continue;
      }

      const endAt = event.endDate?.toJSDate() ?? new Date(startAt.getTime() + 60 * 60 * 1000);
      const allDay = Boolean(event.startDate.isDate);

      imported.push({
        externalId,
        title: title.slice(0, 160),
        description: event.description?.trim()?.slice(0, 2000) ?? null,
        location: event.location?.trim()?.slice(0, 240) ?? null,
        startAt,
        endAt: endAt.getTime() > startAt.getTime() ? endAt : new Date(startAt.getTime() + 60 * 60 * 1000),
        allDay
      });
    } catch {
      continue;
    }
  }

  return imported;
}

export async function fetchIcalFeed(url: string) {
  if (!url.startsWith("https://")) {
    throw new Error("iCal feeds must use HTTPS.");
  }

  const response = await fetch(url, {
    headers: {
      Accept: "text/calendar,text/plain,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch iCal feed (${response.status}).`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error("iCal feed returned an empty response.");
  }

  return text;
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: "refresh_token"
    })
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || typeof payload.expires_in !== "number") {
    throw new Error(payload.error_description ?? payload.error ?? "Google token refresh failed.");
  }

  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in
  };
}

export async function fetchGoogleCalendarEvents(input: {
  accessToken: string;
  calendarId: string;
  timeMin: Date;
}) {
  const calendarId = encodeURIComponent(input.calendarId || "primary");
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set("timeMin", input.timeMin.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Google Calendar event fetch failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  const imported: ImportedCalendarEvent[] = [];

  for (const item of payload.items ?? []) {
    const externalId = item.id?.trim();
    const title = item.summary?.trim();
    const startValue = item.start?.dateTime ?? item.start?.date;
    const endValue = item.end?.dateTime ?? item.end?.date;

    if (!externalId || !title || !startValue) {
      continue;
    }

    const allDay = Boolean(item.start?.date && !item.start?.dateTime);
    const startAt = new Date(startValue);
    const endAt = endValue ? new Date(endValue) : new Date(startAt.getTime() + 60 * 60 * 1000);

    imported.push({
      externalId,
      title: title.slice(0, 160),
      description: item.description?.trim()?.slice(0, 2000) ?? null,
      location: item.location?.trim()?.slice(0, 240) ?? null,
      startAt,
      endAt: endAt.getTime() > startAt.getTime() ? endAt : new Date(startAt.getTime() + 60 * 60 * 1000),
      allDay
    });
  }

  return imported;
}

export async function resolveGoogleAccessToken(
  connection: CalendarConnectionRow,
  oauth: GoogleOAuthConfig
) {
  const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt <= Date.now() + 60_000;

  if (!needsRefresh && connection.accessToken) {
    return (
      decryptCalendarToken(connection.accessToken) ??
      (() => {
        throw new Error("Google Calendar connection is missing an access token. Reconnect Google Calendar.");
      })()
    );
  }

  if (!connection.refreshToken) {
    throw new Error("Google Calendar connection is missing a refresh token. Reconnect Google Calendar.");
  }

  const refreshed = await refreshGoogleAccessToken({
    refreshToken:
      decryptCalendarToken(connection.refreshToken) ??
      (() => {
        throw new Error("Google Calendar connection is missing a refresh token. Reconnect Google Calendar.");
      })(),
    clientId: oauth.clientId,
    clientSecret: oauth.clientSecret
  });

  await db
    .update(calendarConnections)
    .set({
      accessToken: encryptCalendarToken(refreshed.accessToken),
      tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000)
    })
    .where(eq(calendarConnections.id, connection.id));

  return refreshed.accessToken;
}

// Dedupe by family + external source + external event id. Existing rows are skipped; edits/deletes are not reconciled yet.
export async function importCalendarEvents(input: {
  familyId: string;
  userId: string;
  provider: "google" | "ical";
  events: ImportedCalendarEvent[];
}): Promise<CalendarSyncCounts> {
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of input.events) {
    try {
      const existing = await db.query.events.findFirst({
        where: and(
          eq(events.familyId, input.familyId),
          eq(events.externalSource, input.provider),
          eq(events.externalCalendarId, event.externalId)
        )
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await db.insert(events).values({
        familyId: input.familyId,
        title: event.title,
        description: event.description,
        location: event.location,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        externalCalendarId: event.externalId,
        externalSource: input.provider,
        importedFrom: input.provider,
        createdBy: input.userId
      });

      added += 1;
    } catch {
      failed += 1;
    }
  }

  return { added, skipped, failed };
}

export async function syncGoogleConnection(input: {
  connection: CalendarConnectionRow;
  userId: string;
  oauth: GoogleOAuthConfig;
}) {
  const accessToken = await resolveGoogleAccessToken(input.connection, input.oauth);
  const calendarEvents = await fetchGoogleCalendarEvents({
    accessToken,
    calendarId: input.connection.externalCalendarId ?? "primary",
    timeMin: new Date()
  });

  const counts = await importCalendarEvents({
    familyId: input.connection.familyId,
    userId: input.userId,
    provider: "google",
    events: calendarEvents
  });

  await db
    .update(calendarConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(calendarConnections.id, input.connection.id));

  return {
    ...counts,
    message:
      "Imported future Google Calendar events. Duplicate external IDs were skipped; updates and deletions are not reconciled yet."
  };
}

export async function syncIcalConnection(input: {
  connection: CalendarConnectionRow;
  userId: string;
}) {
  if (!input.connection.icalUrl) {
    throw new Error("This iCal connection is missing a feed URL.");
  }

  const feedText = await fetchIcalFeed(input.connection.icalUrl);
  const calendarEvents = parseIcalFeed(feedText);

  const counts = await importCalendarEvents({
    familyId: input.connection.familyId,
    userId: input.userId,
    provider: "ical",
    events: calendarEvents
  });

  await db
    .update(calendarConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(calendarConnections.id, input.connection.id));

  return {
    ...counts,
    message:
      "Imported future iCal events. Duplicate UIDs were skipped; recurring series are not expanded and edits/deletions are not reconciled yet."
  };
}
