import { PgBoss } from "pg-boss";

import { env, getJobsConfig } from "../env.js";
import { buildDailyDigest } from "../lib/familyDigest.js";
import { sendNotificationToFamilyMembers } from "../lib/pushNotifications.js";
import { db } from "../db/client.js";
import { events } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { getTravelReminderRecommendation } from "../lib/travelReminder.js";

let boss: PgBoss | null = null;
let bossStarted = false;

export async function startJobWorker() {
  const config = getJobsConfig();
  if (!config.enabled || bossStarted) {
    return;
  }

  boss = new PgBoss(env.DATABASE_URL);
  await boss.start();
  bossStarted = true;

  await boss.work<{ familyId: string }>("daily-digest-send", async (jobs) => {
    for (const job of jobs) {
      const familyId = String(job.data.familyId);
      const digest = await buildDailyDigest(familyId);
      await sendNotificationToFamilyMembers({
        familyId,
        title: digest.title,
        body: digest.body,
        type: "daily_digest"
      });
    }
  });

  await boss.work<{ familyId: string; eventId: string }>("travel-reminder-send", async (jobs) => {
    for (const job of jobs) {
      const familyId = String(job.data.familyId);
      const eventId = String(job.data.eventId);
      const event = await db.query.events.findFirst({
        where: and(eq(events.familyId, familyId), eq(events.id, eventId))
      });

      if (!event) {
        continue;
      }

      const recommendation = await getTravelReminderRecommendation({
        locationLat: event.locationLat ? Number(event.locationLat) : null,
        locationLng: event.locationLng ? Number(event.locationLng) : null,
        startAt: event.startAt
      });

      if (!recommendation.supported) {
        continue;
      }

      await sendNotificationToFamilyMembers({
        familyId,
        title: `Time to leave for ${event.title}`,
        body: `${recommendation.estimatedTravelMinutes} min travel estimate with a ${recommendation.recommendedLeadMinutes} min reminder buffer.`,
        type: "event_reminder"
      });
    }
  });
}

export async function stopJobWorker() {
  if (boss) {
    await boss.stop();
    boss = null;
  }
  bossStarted = false;
}

export async function enqueueDailyDigestJob(familyId: string) {
  if (!boss || !bossStarted) {
    return null;
  }

  return boss.send("daily-digest-send", { familyId });
}

export async function enqueueTravelReminderJob(familyId: string, eventId: string) {
  if (!boss || !bossStarted) {
    return null;
  }

  return boss.send("travel-reminder-send", { familyId, eventId });
}

export function getJobWorkerStatus() {
  return {
    enabled: getJobsConfig().enabled,
    started: bossStarted
  };
}
