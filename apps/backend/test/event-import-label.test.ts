import { describe, expect, it } from "vitest";

import { describeImportedEventSource } from "../../mobile/src/utils/eventUrgency.js";

describe("imported event labels", () => {
  it("returns null for manual events without import metadata", () => {
    expect(describeImportedEventSource({ externalSource: null, importedFrom: null })).toBeNull();
  });

  it("labels google and ical imports clearly", () => {
    expect(describeImportedEventSource({ externalSource: "google", importedFrom: null })).toBe("Google calendar");
    expect(describeImportedEventSource({ externalSource: null, importedFrom: "ical" })).toBe("iCal feed");
  });

  it("falls back to a generic imported label for unknown providers", () => {
    expect(describeImportedEventSource({ externalSource: "outlook", importedFrom: null })).toBe(
      "Imported (outlook)"
    );
  });
});
