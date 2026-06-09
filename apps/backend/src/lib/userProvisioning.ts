import { db } from "../db/client.js";
import { authUsers, users } from "../db/schema.js";

export async function ensureAuthShadowUser(userId: string) {
  await db
    .insert(authUsers)
    .values({
      id: userId
    })
    .onConflictDoNothing({
      target: authUsers.id
    });
}

export async function ensureUserProfile(userId: string, email: string) {
  await db.transaction(async (tx) => {
    await tx
      .insert(authUsers)
      .values({
        id: userId
      })
      .onConflictDoNothing({
        target: authUsers.id
      });

    await tx
      .insert(users)
      .values({
        id: userId,
        email,
        displayName: email.split("@")[0]
      })
      .onConflictDoNothing({
        target: users.id
      });
  });
}
