import { describe, expect, it } from "vitest";

import { agendaDividerLabel, agendaGroupKey, calendarDayDiff } from "../src/utils/planAgenda";

const now = new Date(2026, 1, 8); // Sun, Feb 8 2026

describe("agendaGroupKey", () => {
  it("groups today, tomorrow, earlier, and dateless events into stable buckets", () => {
    expect(agendaGroupKey({ startAt: new Date(2026, 1, 8, 9, 0).toISOString() }, now)).toBe("today");
    expect(agendaGroupKey({ startAt: new Date(2026, 1, 9, 9, 0).toISOString() }, now)).toBe("tomorrow");
    expect(agendaGroupKey({ startAt: new Date(2026, 1, 1, 9, 0).toISOString() }, now)).toBe("earlier");
    expect(agendaGroupKey({ startAt: null }, now)).toBe("later");
  });

  it("does not collide same weekday/month/day across different years", () => {
    // Regression: the agenda used to group by display label ("Tue, Feb 8"), which
    // dropped the year and silently merged/dropped events a year apart.
    const thisYear = agendaGroupKey({ startAt: new Date(2026, 1, 10, 9, 0).toISOString() }, now);
    const nextYear = agendaGroupKey({ startAt: new Date(2027, 1, 10, 9, 0).toISOString() }, now);

    expect(thisYear).not.toBe(nextYear);
    expect(thisYear).toBe("2026-1-10");
    expect(nextYear).toBe("2027-1-10");
  });
});

describe("agendaDividerLabel", () => {
  it("labels today and tomorrow distinctly from a future weekday date", () => {
    expect(agendaDividerLabel({ startAt: new Date(2026, 1, 8, 9, 0).toISOString() }, now)).toBe("Today");
    expect(agendaDividerLabel({ startAt: new Date(2026, 1, 9, 9, 0).toISOString() }, now)).toBe("Tomorrow");
    expect(agendaDividerLabel({ startAt: null }, now)).toBe("Later");
  });
});

describe("calendarDayDiff", () => {
  it("ignores time-of-day and diffs by calendar date only", () => {
    const lateTonight = new Date(2026, 1, 8, 23, 59);
    const earlyThisMorning = new Date(2026, 1, 8, 0, 1);
    expect(calendarDayDiff(lateTonight, earlyThisMorning)).toBe(0);
  });
});
