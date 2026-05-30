import { PlanEvent } from "../types";

type PillTone = "neutral" | "primary" | "mint" | "coral" | "gold";

export type EventUrgency = {
  label: string;
  tone: PillTone;
  startsAt: Date;
};

export function getEventUrgency(event: Pick<PlanEvent, "startAt">, now = new Date()): EventUrgency | null {
  if (!event.startAt) {
    return null;
  }

  const startsAt = new Date(event.startAt);
  if (Number.isNaN(startsAt.getTime())) {
    return null;
  }

  const diffMs = startsAt.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const dayDiff = differenceInCalendarDays(startsAt, now);

  if (diffMinutes <= 0) {
    if (dayDiff === 0 && diffMinutes > -90) {
      return { label: "Now", tone: "coral", startsAt };
    }

    if (dayDiff === 0) {
      return { label: "Earlier today", tone: "neutral", startsAt };
    }

    return { label: "Past", tone: "neutral", startsAt };
  }

  if (dayDiff === 0) {
    if (diffMinutes < 60) {
      return { label: `In ${Math.max(1, diffMinutes)} min`, tone: "coral", startsAt };
    }

    if (diffMinutes < 180) {
      const hours = Math.ceil(diffMinutes / 60);
      return { label: `In ${hours} hr`, tone: "coral", startsAt };
    }

    const hour = startsAt.getHours();
    if (hour < 12) {
      return { label: "This morning", tone: "gold", startsAt };
    }
    if (hour < 17) {
      return { label: "This afternoon", tone: "gold", startsAt };
    }
    return { label: "Tonight", tone: "gold", startsAt };
  }

  if (dayDiff === 1) {
    return { label: "Tomorrow", tone: "mint", startsAt };
  }

  if (dayDiff < 7) {
    return { label: `In ${dayDiff} days`, tone: "primary", startsAt };
  }

  return {
    label: startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tone: "neutral",
    startsAt
  };
}

export function compareEventsByStartAt(a: Pick<PlanEvent, "startAt">, b: Pick<PlanEvent, "startAt">) {
  const aTime = a.startAt ? new Date(a.startAt).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.startAt ? new Date(b.startAt).getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

function differenceInCalendarDays(a: Date, b: Date) {
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aStart - bStart) / 86400000);
}

export function describeImportedEventSource(
  event: Pick<PlanEvent, "externalSource" | "importedFrom">
): string | null {
  const provider = event.externalSource ?? event.importedFrom;
  if (!provider) {
    return null;
  }

  if (provider === "google") {
    return "Google calendar";
  }

  if (provider === "ical") {
    return "iCal feed";
  }

  return `Imported (${provider})`;
}
