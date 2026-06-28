import { FamilyMember } from "../types";

export type MemberAccessKind = "owner" | "admin" | "member" | "child";

export function getEffectiveFamilyCreatorId(
  familyCreatedBy: string | null | undefined,
  members: ReadonlyArray<Pick<FamilyMember, "userId">>
): string | null {
  if (!familyCreatedBy) {
    return null;
  }

  return members.some((member) => member.userId === familyCreatedBy) ? familyCreatedBy : null;
}

export function getMemberAccessKind(
  member: Pick<FamilyMember, "role" | "userId">,
  familyCreatedBy: string | null | undefined
): MemberAccessKind {
  if (member.role === "kid") {
    return "child";
  }

  if (member.userId && familyCreatedBy && member.userId === familyCreatedBy) {
    return "owner";
  }

  if (member.role === "parent") {
    return "admin";
  }

  return "member";
}

export function getMemberAccessLabel(
  member: Pick<FamilyMember, "role" | "userId">,
  familyCreatedBy: string | null | undefined
) {
  const kind = getMemberAccessKind(member, familyCreatedBy);

  if (kind === "owner") return "Owner";
  if (kind === "admin") return "Admin";
  if (kind === "child") return "Child profile";
  return "Member";
}

export function getCurrentUserAccessLabel(input: {
  isFamilyAdmin: boolean;
  currentUserId: string | null | undefined;
  familyCreatedBy: string | null | undefined;
}) {
  if (input.currentUserId && input.familyCreatedBy && input.currentUserId === input.familyCreatedBy) {
    return "Owner";
  }

  if (input.isFamilyAdmin) {
    return "Admin";
  }

  return "Member";
}

export function getAdultMemberAccountLabel(member: Pick<FamilyMember, "userId" | "isVirtual">) {
  if (member.userId) {
    return "Signed in";
  }

  if (member.isVirtual) {
    return "Profile only";
  }

  return "No linked account";
}

export function getMemberProfileLabel(member: Pick<FamilyMember, "role">) {
  if (member.role === "kid") {
    return "Child";
  }

  if (member.role === "parent") {
    return "Adult admin";
  }

  return "Adult";
}
