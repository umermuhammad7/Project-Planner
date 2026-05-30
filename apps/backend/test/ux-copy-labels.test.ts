import { describe, expect, it } from "vitest";

import { formatNotificationType } from "../../mobile/src/utils/notificationLabels.js";
import { formatThreadConversion, formatThreadDirection } from "../../mobile/src/utils/threadLabels.js";
import { getSyncPillLabel, getSyncStatusLine } from "../../mobile/src/utils/syncTrustCopy.js";

describe("ux copy helpers", () => {
  it("uses calm sync pill labels", () => {
    expect(getSyncPillLabel("api")).toBe("Household synced");
    expect(getSyncPillLabel("mock")).toBe("Local preview");
  });

  it("shortens tab-screen sync status lines", () => {
    expect(getSyncStatusLine({ syncSource: "mock", isHydrating: false })).toContain("Preview data");
    expect(getSyncStatusLine({ syncSource: "api", isHydrating: true })).toContain("Refreshing");
  });

  it("labels notification and thread sources clearly", () => {
    expect(formatNotificationType("daily_digest")).toBe("Daily digest");
    expect(formatThreadDirection("inbound")).toBe("From a family text");
    expect(formatThreadConversion("event")).toBe("Saved to Plan");
  });
});
