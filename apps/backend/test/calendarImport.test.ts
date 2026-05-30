import { describe, expect, it } from "vitest";

import { parseIcalFeed } from "../src/lib/calendarImport.js";

function toIcsUtc(date: Date) {
  return date.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

function buildSampleFeed(startAt: Date) {
  const stamp = toIcsUtc(startAt);

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HomeThread//Calendar Import Test//EN
BEGIN:VEVENT
UID:homethread-test-event-1
SUMMARY:School pickup
LOCATION:Main office
DTSTART:${stamp}
DTEND:${stamp}
END:VEVENT
END:VCALENDAR`;
}

describe("calendar import helpers", () => {
  it("parses future iCal events and skips past events", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const parsedFuture = parseIcalFeed(buildSampleFeed(future), new Date());

    expect(parsedFuture).toHaveLength(1);
    expect(parsedFuture[0]).toMatchObject({
      externalId: "homethread-test-event-1",
      title: "School pickup",
      location: "Main office"
    });

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const parsedPast = parseIcalFeed(buildSampleFeed(past), new Date());
    expect(parsedPast).toHaveLength(0);
  });
});
