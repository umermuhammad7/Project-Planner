import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, pool } from "../db/client.js";
import {
  choreCompletions,
  chores,
  eventMembers,
  events,
  families,
  familyMembers,
  listItems,
  lists,
  mealPlanItems,
  mealPlans,
  rewards,
  users
} from "../db/schema.js";

const devUserId = "00000000-0000-4000-8000-000000000001";
const maraMemberId = "00000000-0000-4000-8000-000000000101";
const julesMemberId = "00000000-0000-4000-8000-000000000102";
const noahMemberId = "00000000-0000-4000-8000-000000000103";
const familyId = "00000000-0000-4000-8000-000000000201";
const pickupEventId = "00000000-0000-4000-8000-000000000301";
const soccerEventId = "00000000-0000-4000-8000-000000000302";
const dishwasherChoreId = "00000000-0000-4000-8000-000000000401";
const dishwasherCompletionId = "00000000-0000-4000-8000-000000000402";
const julesRewardId = "00000000-0000-4000-8000-000000000403";
const groceryListId = "00000000-0000-4000-8000-000000000501";
const oatMilkItemId = "00000000-0000-4000-8000-000000000511";
const bananasItemId = "00000000-0000-4000-8000-000000000512";
const mealPlanId = "00000000-0000-4000-8000-000000000601";
const dinnerMondayId = "00000000-0000-4000-8000-000000000611";
const dinnerTuesdayId = "00000000-0000-4000-8000-000000000612";
const dinnerWednesdayId = "00000000-0000-4000-8000-000000000613";

try {
  await db.transaction(async (tx) => {
    await tx.execute(`insert into auth.users (id) values ('${devUserId}') on conflict (id) do nothing`);

    await tx
      .insert(users)
      .values({
        id: devUserId,
        email: "dev@homethread.local",
        displayName: "Mara",
        timezone: "America/New_York"
      })
      .onConflictDoNothing();

    await tx
      .insert(families)
      .values({
        id: familyId,
        name: "The Parker Home",
        inviteCode: "HT2026",
        createdBy: devUserId
      })
      .onConflictDoNothing();

    await tx
      .insert(familyMembers)
      .values([
        {
          id: maraMemberId,
          familyId,
          userId: devUserId,
          displayName: "Mara",
          color: "#3157D5",
          role: "admin",
          isVirtual: false
        },
        {
          id: julesMemberId,
          familyId,
          displayName: "Jules",
          color: "#F9735B",
          role: "child",
          isVirtual: true
        },
        {
          id: noahMemberId,
          familyId,
          displayName: "Noah",
          color: "#2DAA84",
          role: "child",
          isVirtual: true
        }
      ])
      .onConflictDoNothing();

    await tx
      .insert(events)
      .values([
        {
          id: pickupEventId,
          familyId,
          title: "School pickup",
          location: "Westbrook Elementary",
          startAt: new Date("2026-06-01T15:10:00-04:00"),
          endAt: new Date("2026-06-01T15:35:00-04:00"),
          createdBy: devUserId
        },
        {
          id: soccerEventId,
          familyId,
          title: "Noah soccer practice",
          location: "Field 4",
          startAt: new Date("2026-06-01T17:00:00-04:00"),
          endAt: new Date("2026-06-01T18:00:00-04:00"),
          createdBy: devUserId
        }
      ])
      .onConflictDoNothing();

    await tx
      .insert(eventMembers)
      .values([
        { eventId: pickupEventId, memberId: julesMemberId },
        { eventId: pickupEventId, memberId: noahMemberId },
        { eventId: soccerEventId, memberId: noahMemberId }
      ])
      .onConflictDoNothing();

    await tx
      .insert(chores)
      .values({
        id: dishwasherChoreId,
        familyId,
        title: "Unload dishwasher",
        icon: "sparkles",
        starsValue: 2,
        assignedTo: julesMemberId,
        dueTime: "18:00:00",
        createdBy: devUserId
      })
      .onConflictDoNothing();

    await tx
      .insert(choreCompletions)
      .values({
        id: dishwasherCompletionId,
        choreId: dishwasherChoreId,
        memberId: julesMemberId,
        dueDate: "2026-06-01",
        notes: "Seed completion"
      })
      .onConflictDoNothing();

    await tx
      .insert(rewards)
      .values({
        id: julesRewardId,
        familyId,
        memberId: julesMemberId,
        stars: 2,
        reason: "chore_complete"
      })
      .onConflictDoNothing();

    await tx
      .insert(lists)
      .values({
        id: groceryListId,
        familyId,
        title: "Groceries",
        type: "grocery",
        icon: "basket",
        createdBy: devUserId
      })
      .onConflictDoNothing();

    await tx
      .insert(listItems)
      .values([
        {
          id: oatMilkItemId,
          listId: groceryListId,
          content: "Oat milk",
          category: "dairy",
          createdBy: devUserId,
          sortOrder: 1
        },
        {
          id: bananasItemId,
          listId: groceryListId,
          content: "Bananas",
          category: "produce",
          createdBy: devUserId,
          sortOrder: 2
        }
      ])
      .onConflictDoNothing();

    await tx
      .insert(mealPlans)
      .values({
        id: mealPlanId,
        familyId,
        weekStart: "2026-05-25",
        createdBy: devUserId
      })
      .onConflictDoNothing();

    await tx
      .insert(mealPlanItems)
      .values([
        {
          id: dinnerMondayId,
          planId: mealPlanId,
          dayOfWeek: 0,
          mealType: "dinner",
          customTitle: "Sheet-pan chicken fajitas",
          notes: "Double peppers for leftovers"
        },
        {
          id: dinnerTuesdayId,
          planId: mealPlanId,
          dayOfWeek: 1,
          mealType: "dinner",
          customTitle: "Pasta night",
          notes: "Use the spinach in the fridge"
        },
        {
          id: dinnerWednesdayId,
          planId: mealPlanId,
          dayOfWeek: 2,
          mealType: "dinner",
          customTitle: "Breakfast-for-dinner",
          notes: "Pancakes and fruit"
        }
      ])
      .onConflictDoNothing();
  });

  const family = await db.query.families.findFirst({
    where: eq(families.id, familyId)
  });
  console.log(`Seeded HomeThread dev data for ${family?.name ?? familyId}`);
} finally {
  await pool.end();
}
