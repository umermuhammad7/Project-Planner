import { and, eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { familyMembers } from "../db/schema.js";

export async function countFamilyAdmins(familyId: string) {
  const admins = await db.query.familyMembers.findMany({
    where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.role, "admin"))
  });

  return admins.length;
}
