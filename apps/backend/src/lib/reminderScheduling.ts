import { getTravelReminderRecommendation } from "./travelReminder.js";
import {
  cancelReminderJobs,
  choreReminderSingletonKey,
  eventReminderSingletonKey,
  scheduleChoreReminderJob,
  scheduleEventReminderJob,
  scheduleTravelReminderJob,
  travelReminderSingletonKey,
  CHORE_REMINDER_QUEUE,
  EVENT_REMINDER_QUEUE,
  TRAVEL_REMINDER_QUEUE
} from "../jobs/boss.js";

export const CHORE_REMINDER_LEAD_MINUTES = 30;
export const EVENT_REMINDER_LEAD_MINUTES = 15;
export const DEFAULT_CHORE_REMINDER_HOUR = 9;

type ChoreScheduleInput = {
  id: string;
  familyId: string;
  assignedTo: string | null;
  dueTime: string | null;
  isActive: boolean;
};

type EventScheduleInput = {
  id: string;
  familyId: string;
  startAt: Date;
  locationLat: string | null;
  locationLng: string | null;
};

export function computeNextChoreReminderAt(
  dueTime: string | null,
  now = new Date()
): { remindAt: Date; dueDate: string } | null {
  const buildReminder = (dueAt: Date) => {
    const remindAt = new Date(dueAt.getTime() - CHORE_REMINDER_LEAD_MINUTES * 60 * 1000);
    return {
      remindAt,
      dueDate: dueAt.toISOString().slice(0, 10)
    };
  };

  if (dueTime) {
    const [hours, minutes] = dueTime.split(":").map((value) => Number(value));
    const dueAt = new Date(now);
    dueAt.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    if (dueAt.getTime() <= now.getTime()) {
      dueAt.setDate(dueAt.getDate() + 1);
    }

    return buildReminder(dueAt);
  }

  const dueAt = new Date(now);
  dueAt.setHours(DEFAULT_CHORE_REMINDER_HOUR, 0, 0, 0);
  if (dueAt.getTime() <= now.getTime()) {
    dueAt.setDate(dueAt.getDate() + 1);
  }

  return buildReminder(dueAt);
}

export async function syncChoreReminderSchedule(chore: ChoreScheduleInput) {
  await cancelChoreReminderSchedule(chore.familyId, chore.id);

  if (!chore.isActive || !chore.assignedTo) {
    return { scheduled: false as const, reason: "inactive_or_unassigned" as const };
  }

  const schedule = computeNextChoreReminderAt(chore.dueTime);
  if (!schedule) {
    return { scheduled: false as const, reason: "no_schedule" as const };
  }

  const jobId = await scheduleChoreReminderJob({
    familyId: chore.familyId,
    choreId: chore.id,
    memberId: chore.assignedTo,
    dueDate: schedule.dueDate,
    startAfter: schedule.remindAt
  });

  return {
    scheduled: Boolean(jobId),
    reason: jobId ? ("queued" as const) : ("jobs_disabled" as const),
    remindAt: schedule.remindAt.toISOString(),
    dueDate: schedule.dueDate
  };
}

export async function cancelChoreReminderSchedule(familyId: string, choreId: string) {
  await cancelReminderJobs(CHORE_REMINDER_QUEUE, choreReminderSingletonKey(familyId, choreId));
}

export async function cancelChoreReminderForDate(familyId: string, choreId: string) {
  await cancelChoreReminderSchedule(familyId, choreId);
}

export async function syncEventReminderSchedule(event: EventScheduleInput) {
  await cancelEventReminderSchedule(event.familyId, event.id);

  if (event.startAt.getTime() <= Date.now()) {
    return { scheduled: false as const, reason: "event_in_past" as const };
  }

  const recommendation = await getTravelReminderRecommendation({
    locationLat: event.locationLat ? Number(event.locationLat) : null,
    locationLng: event.locationLng ? Number(event.locationLng) : null,
    startAt: event.startAt
  });

  let travelJobId: string | null = null;
  if (recommendation.supported && recommendation.recommendedLeadMinutes) {
    const travelAt = new Date(event.startAt.getTime() - recommendation.recommendedLeadMinutes * 60 * 1000);
    travelJobId = await scheduleTravelReminderJob({
      familyId: event.familyId,
      eventId: event.id,
      startAfter: travelAt
    });
  }

  const eventAt = new Date(event.startAt.getTime() - EVENT_REMINDER_LEAD_MINUTES * 60 * 1000);
  const eventJobId = await scheduleEventReminderJob({
    familyId: event.familyId,
    eventId: event.id,
    startAfter: eventAt
  });

  return {
    scheduled: Boolean(travelJobId || eventJobId),
    reason: travelJobId || eventJobId ? ("queued" as const) : ("jobs_disabled" as const),
    travelReminderAt: travelJobId
      ? new Date(event.startAt.getTime() - (recommendation.recommendedLeadMinutes ?? 0) * 60 * 1000).toISOString()
      : null,
    eventReminderAt: eventJobId ? eventAt.toISOString() : null
  };
}

export async function cancelEventReminderSchedule(familyId: string, eventId: string) {
  await Promise.all([
    cancelReminderJobs(TRAVEL_REMINDER_QUEUE, travelReminderSingletonKey(familyId, eventId)),
    cancelReminderJobs(EVENT_REMINDER_QUEUE, eventReminderSingletonKey(familyId, eventId))
  ]);
}
