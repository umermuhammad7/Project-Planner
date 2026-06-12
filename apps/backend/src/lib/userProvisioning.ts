import { eq, sql } from "drizzle-orm";

import { db } from "../db/client.js";
import {
  aiConversations,
  authUsers,
  calendarConnections,
  chores,
  events,
  families,
  familyMembers,
  listItems,
  lists,
  mealPlans,
  notifications,
  recipes,
  users
} from "../db/schema.js";

type UserProvisioningTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

    const existingById = await tx.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (existingById) {
      if (existingById.email !== email) {
        await tx
          .update(users)
          .set({
            email,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }
      return;
    }

    const existingByEmail = await tx.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!existingByEmail) {
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
      return;
    }

    if (existingByEmail.id !== userId) {
      const migratedEmail = `migrated+${existingByEmail.id}@homethread.local`;

      await tx
        .update(users)
        .set({
          email: migratedEmail,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingByEmail.id));

      await tx.insert(users).values({
        id: userId,
        email,
        displayName: existingByEmail.displayName,
        avatarUrl: existingByEmail.avatarUrl,
        phone: existingByEmail.phone,
        timezone: existingByEmail.timezone,
        locale: existingByEmail.locale,
        pushToken: existingByEmail.pushToken,
        notificationPrefs: existingByEmail.notificationPrefs,
        createdAt: existingByEmail.createdAt,
        updatedAt: new Date()
      });

      await reassignUserReferences(tx, existingByEmail.id, userId);

      await tx.delete(users).where(eq(users.id, existingByEmail.id));
    }
  });
}

async function reassignUserReferences(tx: UserProvisioningTx, fromUserId: string, toUserId: string) {
  await tx.execute(sql`
    delete from family_members as source
    using family_members as target
    where source.user_id = ${fromUserId}
      and target.user_id = ${toUserId}
      and source.family_id = target.family_id
  `);

  await tx.update(families).set({ createdBy: toUserId }).where(eq(families.createdBy, fromUserId));
  await tx.update(familyMembers).set({ userId: toUserId }).where(eq(familyMembers.userId, fromUserId));
  await tx.update(events).set({ createdBy: toUserId }).where(eq(events.createdBy, fromUserId));
  await tx.update(chores).set({ createdBy: toUserId }).where(eq(chores.createdBy, fromUserId));
  await tx.update(lists).set({ createdBy: toUserId }).where(eq(lists.createdBy, fromUserId));
  await tx.update(listItems).set({ createdBy: toUserId }).where(eq(listItems.createdBy, fromUserId));
  await tx.update(mealPlans).set({ createdBy: toUserId }).where(eq(mealPlans.createdBy, fromUserId));
  await tx.update(recipes).set({ createdBy: toUserId }).where(eq(recipes.createdBy, fromUserId));
  await tx.update(notifications).set({ userId: toUserId }).where(eq(notifications.userId, fromUserId));
  await tx.update(calendarConnections).set({ userId: toUserId }).where(eq(calendarConnections.userId, fromUserId));
  await tx.update(aiConversations).set({ userId: toUserId }).where(eq(aiConversations.userId, fromUserId));
}
