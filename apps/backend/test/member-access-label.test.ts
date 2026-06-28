import { describe, expect, it } from "vitest";

import {
  getCurrentUserAccessLabel,
  getEffectiveFamilyCreatorId,
  getMemberAccessLabel
} from "../../mobile/src/utils/memberAccessLabel.js";

describe("memberAccessLabel", () => {
  it("labels the creator as Owner only while they remain in the household", () => {
    const members = [
      { userId: "user-owner" },
      { userId: "user-admin" }
    ];

    expect(getEffectiveFamilyCreatorId("user-owner", members)).toBe("user-owner");
    expect(
      getMemberAccessLabel({ role: "parent", userId: "user-owner" }, getEffectiveFamilyCreatorId("user-owner", members))
    ).toBe("Owner");
    expect(
      getMemberAccessLabel({ role: "parent", userId: "user-admin" }, getEffectiveFamilyCreatorId("user-owner", members))
    ).toBe("Admin");
  });

  it("does not label a promoted admin as Owner after the creator leaves", () => {
    const membersAfterLeave = [{ userId: "user-admin" }];

    expect(getEffectiveFamilyCreatorId("user-owner", membersAfterLeave)).toBeNull();
    expect(
      getMemberAccessLabel(
        { role: "parent", userId: "user-admin" },
        getEffectiveFamilyCreatorId("user-owner", membersAfterLeave)
      )
    ).toBe("Admin");
    expect(
      getCurrentUserAccessLabel({
        isFamilyAdmin: true,
        currentUserId: "user-admin",
        familyCreatedBy: getEffectiveFamilyCreatorId("user-owner", membersAfterLeave)
      })
    ).toBe("Admin");
  });
});
