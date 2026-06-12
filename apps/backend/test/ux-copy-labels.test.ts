import { describe, expect, it } from "vitest";

import { getClientBuildReadiness } from "../../mobile/src/utils/buildReadiness.js";
import { formatNotificationType } from "../../mobile/src/utils/notificationLabels.js";
import { formatThreadConversion, formatThreadDirection } from "../../mobile/src/utils/threadLabels.js";
import { getSyncPillLabel, getSyncStatusLine } from "../../mobile/src/utils/syncTrustCopy.js";

describe("ux copy helpers", () => {
  it("uses calm sync pill labels", () => {
    expect(getSyncPillLabel("api")).toBe("Household synced");
    expect(getSyncPillLabel("mock")).toBe("On this device");
  });

  it("shortens tab-screen sync status lines", () => {
    expect(getSyncStatusLine({ syncSource: "mock", isHydrating: false })).toContain("Preview data on this device");
    expect(getSyncStatusLine({ syncSource: "api", isHydrating: true })).toContain("Refreshing");
  });

  it("labels notification and thread sources clearly", () => {
    expect(formatNotificationType("daily_digest")).toBe("Daily digest");
    expect(formatThreadDirection("inbound")).toBe("From a family text");
    expect(formatThreadConversion("event")).toBe("Saved to Plan");
  });

  it("describes client build readiness without vendor env var names", () => {
    const readiness = getClientBuildReadiness();
    const labels = readiness.map((item) => item.label);

    expect(labels).toEqual(
      expect.arrayContaining(["Household server", "Account sign-in", "Push registration", "Store billing SDK"])
    );

    for (const item of readiness) {
      expect(item.detail).not.toMatch(/EXPO_PUBLIC_|Supabase|RevenueCat/i);
    }
  });
});
