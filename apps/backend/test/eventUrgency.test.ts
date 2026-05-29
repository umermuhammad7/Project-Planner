import { describe, expect, it } from "vitest";

import { compareEventsByStartAt, getEventUrgency } from "../../mobile/src/utils/eventUrgency.js";

describe("event urgency helpers", () => {
  it("marks near-term same-day events with minute countdowns", () => {
    const now = new Date("2026-05-29T15:00:00");
    const urgency = getEventUrgency({ startAt: "2026-05-29T15:25:00" }, now);

    expect(urgency).toMatchObject({
      label: "In 25 min",
      tone: "coral"
    });
  });

  it("marks tomorrow events clearly", () => {
    const now = new Date("2026-05-29T20:00:00");
    const urgency = getEventUrgency({ startAt: "2026-05-30T09:00:00" }, now);

    expect(urgency).toMatchObject({
      label: "Tomorrow",
      tone: "mint"
    });
  });

  it("sorts events by ascending start time", () => {
    const early = { startAt: "2026-05-29T09:00:00" };
    const late = { startAt: "2026-05-29T18:00:00" };

    expect(compareEventsByStartAt(early, late)).toBeLessThan(0);
    expect(compareEventsByStartAt(late, early)).toBeGreaterThan(0);
  });
});
