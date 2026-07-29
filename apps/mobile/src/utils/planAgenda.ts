import type { PlanEvent } from "../types";

export function calendarDayDiff(value: Date, now: Date) {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((start - today) / 86400000);
}

export function agendaDividerLabel(event: Pick<PlanEvent, "startAt">, now = new Date()) {
  if (!event.startAt) {
    return "Later";
  }

  const startsAt = new Date(event.startAt);
  if (Number.isNaN(startsAt.getTime())) {
    return "Later";
  }

  const dayDiff = calendarDayDiff(startsAt, now);
  if (dayDiff === 0) {
    return "Today";
  }
  if (dayDiff === 1) {
    return "Tomorrow";
  }
  if (dayDiff < 0) {
    return "Earlier";
  }

  return startsAt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

export function agendaGroupKey(event: Pick<PlanEvent, "startAt">, now = new Date()) {
  if (!event.startAt) {
    return "later";
  }

  const startsAt = new Date(event.startAt);
  if (Number.isNaN(startsAt.getTime())) {
    return "later";
  }

  const dayDiff = calendarDayDiff(startsAt, now);
  if (dayDiff === 0) {
    return "today";
  }
  if (dayDiff === 1) {
    return "tomorrow";
  }
  if (dayDiff < 0) {
    return "earlier";
  }

  return `${startsAt.getFullYear()}-${startsAt.getMonth()}-${startsAt.getDate()}`;
}
