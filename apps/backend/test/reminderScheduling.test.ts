import { describe, expect, it } from "vitest";

import {
  CHORE_REMINDER_LEAD_MINUTES,
  computeNextChoreReminderAt,
  DEFAULT_CHORE_REMINDER_HOUR
} from "../src/lib/reminderScheduling.js";

function expectedChoreReminder(dueTime: string | null, now: Date) {
  const buildReminder = (dueAt: Date) => ({
    remindAt: new Date(dueAt.getTime() - CHORE_REMINDER_LEAD_MINUTES * 60 * 1000),
    dueDate: dueAt.toISOString().slice(0, 10)
  });

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

describe("reminder scheduling helpers", () => {
  it("schedules chore reminders before the due time", () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    const schedule = computeNextChoreReminderAt("18:00:00", now);
    const expected = expectedChoreReminder("18:00:00", now);

    expect(schedule).not.toBeNull();
    expect(schedule?.dueDate).toBe(expected.dueDate);
    expect(schedule?.remindAt.getTime()).toBe(expected.remindAt.getTime());
  });

  it("rolls chore reminders to the next day after the due time passes", () => {
    const now = new Date("2026-06-01T19:00:00.000Z");
    const schedule = computeNextChoreReminderAt("18:00:00", now);
    const expected = expectedChoreReminder("18:00:00", now);

    expect(schedule?.dueDate).toBe(expected.dueDate);
    expect(schedule?.remindAt.getTime()).toBe(expected.remindAt.getTime());
  });

  it("uses the default morning reminder when a chore has no due time", () => {
    const now = new Date("2026-06-01T08:00:00.000Z");
    const schedule = computeNextChoreReminderAt(null, now);
    const expected = expectedChoreReminder(null, now);

    expect(schedule?.dueDate).toBe(expected.dueDate);
    expect(schedule?.remindAt.getTime()).toBe(expected.remindAt.getTime());
  });
});
