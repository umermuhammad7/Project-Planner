import { PgBoss } from "pg-boss";

import { env, getJobsConfig } from "../env.js";
import { buildDailyDigest } from "../lib/familyDigest.js";
import { deliverHouseholdNotification } from "../lib/pushNotifications.js";
import { db } from "../db/client.js";
import { choreCompletions, chores, eventMembers, events } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { getTravelReminderRecommendation } from "../lib/travelReminder.js";

const DAILY_DIGEST_QUEUE = "daily-digest-send";
export const TRAVEL_REMINDER_QUEUE = "travel-reminder-send";
export const EVENT_REMINDER_QUEUE = "event-reminder-send";
export const CHORE_REMINDER_QUEUE = "chore-reminder-send";

let boss: PgBoss | null = null;
let bossStarted = false;

type ChoreReminderJob = {
  familyId: string;
  choreId: string;
  memberId: string;
  dueDate: string;
};

type EventReminderJob = {
  familyId: string;
  eventId: string;
};

export async function startJobWorker() {
  const config = getJobsConfig();
  if (!config.enabled || bossStarted) {
    return;
  }

  boss = new PgBoss(env.DATABASE_URL);
  boss.on("error", (error) => {
    console.error("HomeThread job worker error", error);
  });
  await boss.start();
  await ensureQueues(boss);
  bossStarted = true;

  await boss.work<{ familyId: string }>(DAILY_DIGEST_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const familyId = String(job.data.familyId);
      const digest = await buildDailyDigest(familyId);
      await deliverHouseholdNotification({
        familyId,
        title: digest.title,
        body: digest.body,
        type: "daily_digest"
      });
    }
  });

  await boss.work<EventReminderJob>(TRAVEL_REMINDER_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const familyId = String(job.data.familyId);
      const eventId = String(job.data.eventId);
      const event = await db.query.events.findFirst({
        where: and(eq(events.familyId, familyId), eq(events.id, eventId))
      });

      if (!event || event.startAt.getTime() <= Date.now()) {
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

      const assignedMembers = await db.query.eventMembers.findMany({
        where: eq(eventMembers.eventId, eventId)
      });
      const targetMemberIds = assignedMembers.map((row) => row.memberId);

      await deliverHouseholdNotification({
        familyId,
        title: `Time to leave for ${event.title}`,
        body: `${recommendation.estimatedTravelMinutes} min travel estimate with a ${recommendation.recommendedLeadMinutes} min reminder buffer.`,
        type: "travel_reminder",
        targetMemberIds: targetMemberIds.length > 0 ? targetMemberIds : undefined
      });
    }
  });

  await boss.work<EventReminderJob>(EVENT_REMINDER_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const familyId = String(job.data.familyId);
      const eventId = String(job.data.eventId);
      const event = await db.query.events.findFirst({
        where: and(eq(events.familyId, familyId), eq(events.id, eventId))
      });

      if (!event || event.startAt.getTime() <= Date.now()) {
        continue;
      }

      const assignedMembers = await db.query.eventMembers.findMany({
        where: eq(eventMembers.eventId, eventId)
      });
      const targetMemberIds = assignedMembers.map((row) => row.memberId);
      const startLabel = event.startAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      await deliverHouseholdNotification({
        familyId,
        title: `Coming up: ${event.title}`,
        body: `${event.title} starts at ${startLabel}.`,
        type: "event_reminder",
        targetMemberIds: targetMemberIds.length > 0 ? targetMemberIds : undefined
      });
    }
  });

  await boss.work<ChoreReminderJob>(CHORE_REMINDER_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const familyId = String(job.data.familyId);
      const choreId = String(job.data.choreId);
      const memberId = String(job.data.memberId);
      const dueDate = String(job.data.dueDate);

      const chore = await db.query.chores.findFirst({
        where: and(eq(chores.familyId, familyId), eq(chores.id, choreId), eq(chores.isActive, true))
      });

      if (!chore || chore.assignedTo !== memberId) {
        continue;
      }

      const completion = await db.query.choreCompletions.findFirst({
        where: and(
          eq(choreCompletions.choreId, choreId),
          eq(choreCompletions.memberId, memberId),
          eq(choreCompletions.dueDate, dueDate)
        )
      });

      if (completion) {
        continue;
      }

      await deliverHouseholdNotification({
        familyId,
        title: "Chore reminder",
        body: chore.dueTime ? `${chore.title} is due at ${chore.dueTime}.` : `${chore.title} is due today.`,
        type: "chore_reminder",
        targetMemberIds: [memberId]
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

  return boss.send(DAILY_DIGEST_QUEUE, { familyId });
}

export async function scheduleTravelReminderJob(input: {
  familyId: string;
  eventId: string;
  startAfter: Date;
}) {
  if (!boss || !bossStarted || input.startAfter.getTime() <= Date.now()) {
    return null;
  }

  await cancelReminderJobs(TRAVEL_REMINDER_QUEUE, travelReminderSingletonKey(input.familyId, input.eventId));

  return boss.send(
    TRAVEL_REMINDER_QUEUE,
    { familyId: input.familyId, eventId: input.eventId },
    {
      startAfter: input.startAfter,
      singletonKey: travelReminderSingletonKey(input.familyId, input.eventId)
    }
  );
}

export async function scheduleEventReminderJob(input: {
  familyId: string;
  eventId: string;
  startAfter: Date;
}) {
  if (!boss || !bossStarted || input.startAfter.getTime() <= Date.now()) {
    return null;
  }

  await cancelReminderJobs(EVENT_REMINDER_QUEUE, eventReminderSingletonKey(input.familyId, input.eventId));

  return boss.send(
    EVENT_REMINDER_QUEUE,
    { familyId: input.familyId, eventId: input.eventId },
    {
      startAfter: input.startAfter,
      singletonKey: eventReminderSingletonKey(input.familyId, input.eventId)
    }
  );
}

export async function scheduleChoreReminderJob(input: {
  familyId: string;
  choreId: string;
  memberId: string;
  dueDate: string;
  startAfter: Date;
}) {
  if (!boss || !bossStarted || input.startAfter.getTime() <= Date.now()) {
    return null;
  }

  await cancelReminderJobs(CHORE_REMINDER_QUEUE, choreReminderSingletonKey(input.familyId, input.choreId));

  return boss.send(
    CHORE_REMINDER_QUEUE,
    {
      familyId: input.familyId,
      choreId: input.choreId,
      memberId: input.memberId,
      dueDate: input.dueDate
    },
    {
      startAfter: input.startAfter,
      singletonKey: choreReminderSingletonKey(input.familyId, input.choreId)
    }
  );
}

export async function cancelReminderJobs(queueName: string, singletonKey: string) {
  if (!boss || !bossStarted) {
    return;
  }

  const jobs = await boss.findJobs(queueName, { key: singletonKey, queued: true });
  if (jobs.length === 0) {
    return;
  }

  await boss.cancel(
    queueName,
    jobs.map((job) => job.id)
  );
}

export function travelReminderSingletonKey(familyId: string, eventId: string) {
  return `travel:${familyId}:${eventId}`;
}

export function eventReminderSingletonKey(familyId: string, eventId: string) {
  return `event:${familyId}:${eventId}`;
}

export function choreReminderSingletonKey(familyId: string, choreId: string) {
  return `chore:${familyId}:${choreId}`;
}

export function getJobWorkerStatus() {
  return {
    enabled: getJobsConfig().enabled,
    started: bossStarted
  };
}

async function ensureQueues(worker: PgBoss) {
  for (const queueName of [DAILY_DIGEST_QUEUE, TRAVEL_REMINDER_QUEUE, EVENT_REMINDER_QUEUE, CHORE_REMINDER_QUEUE]) {
    try {
      await worker.createQueue(queueName, { policy: "short" });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.toLowerCase().includes("already exists")) {
        throw error;
      }
    }
  }
}
