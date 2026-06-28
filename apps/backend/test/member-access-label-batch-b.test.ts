import { describe, expect, it } from "vitest";

import {
  getAdultMemberAccountLabel,
  getMemberProfileLabel
} from "../../mobile/src/utils/memberAccessLabel.js";

describe("memberAccessLabel batch B helpers", () => {
  it("uses truthful adult account labels", () => {
    expect(getAdultMemberAccountLabel({ userId: "user-1", isVirtual: false })).toBe("Signed in");
    expect(getAdultMemberAccountLabel({ userId: null, isVirtual: true })).toBe("Profile only");
    expect(getAdultMemberAccountLabel({ userId: null, isVirtual: false })).toBe("No linked account");
  });

  it("maps internal roles to consumer profile labels", () => {
    expect(getMemberProfileLabel({ role: "kid" })).toBe("Child");
    expect(getMemberProfileLabel({ role: "parent" })).toBe("Adult admin");
    expect(getMemberProfileLabel({ role: "caregiver" })).toBe("Adult");
  });
});
