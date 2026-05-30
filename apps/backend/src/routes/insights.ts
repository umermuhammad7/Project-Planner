import {
  insightsBusynessResponseSchema,
  insightsChoresResponseSchema,
  insightsWeeklyResponseSchema,
  uuidSchema
} from "@homethread/shared";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import {
  choreCompletions,
  chores,
  eventMembers,
  events,
  familyMembers,
  mealPlanItems,
  mealPlans,
  notifications,
  rewards
} from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const paramsSchema = z.object({
  familyId: uuidSchema
});

const WEEKLY_WINDOW_DAYS = 7;
const CHORE_WINDOW_DAYS = 30;
const BUSYNESS_WINDOW_DAYS = 14;

export async function insightsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/weekly", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = paramsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const now = new Date();
    const windowEnd = addDays(now, WEEKLY_WINDOW_DAYS);
    const weekStart = startOfWeek(now);

    const [upcomingEventsRows, openChoresRows, unreadNotificationsRows, memberRows, currentWeekPlan, currentWeekItems] =
      await Promise.all([
        db.query.events.findMany({
          where: and(eq(events.familyId, familyId), gte(events.startAt, now), lte(events.startAt, windowEnd))
        }),
        db.query.chores.findMany({
          where: and(eq(chores.familyId, familyId), eq(chores.isActive, true))
        }),
        db.query.notifications.findMany({
          where: and(
            eq(notifications.userId, currentUser.id),
            eq(notifications.familyId, familyId),
            isNull(notifications.readAt)
          )
        }),
        db.query.familyMembers.findMany({
          where: eq(familyMembers.familyId, familyId)
        }),
        db.query.mealPlans.findFirst({
          where: and(eq(mealPlans.familyId, familyId), eq(mealPlans.weekStart, weekStart))
        }),
        db.query.mealPlanItems.findMany()
      ]);

    const plannedMeals = currentWeekPlan
      ? currentWeekItems.filter((item) => item.planId === currentWeekPlan.id).length
      : 0;

    return insightsWeeklyResponseSchema.parse({
      windowDays: WEEKLY_WINDOW_DAYS,
      upcomingEvents: upcomingEventsRows.length,
      openChores: openChoresRows.length,
      plannedMeals,
      unreadNotifications: unreadNotificationsRows.length,
      activeMembers: memberRows.length
    });
  });

  app.get("/chores", async (request, reply) => {
    const { familyId } = paramsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const windowStart = addDays(new Date(), -CHORE_WINDOW_DAYS);
    const [memberRows, choreRows, completionRows, rewardRows] = await Promise.all([
      db.query.familyMembers.findMany({
        where: eq(familyMembers.familyId, familyId)
      }),
      db.query.chores.findMany({
        where: and(eq(chores.familyId, familyId), eq(chores.isActive, true))
      }),
      db
        .select({
          memberId: choreCompletions.memberId,
          completedAt: choreCompletions.completedAt
        })
        .from(choreCompletions)
        .innerJoin(chores, eq(choreCompletions.choreId, chores.id))
        .where(and(eq(chores.familyId, familyId), gte(choreCompletions.completedAt, windowStart))),
      db.query.rewards.findMany({
        where: and(eq(rewards.familyId, familyId), gte(rewards.createdAt, windowStart))
      })
    ]);

    const completionCountByMemberId = new Map<string, number>();
    for (const row of completionRows) {
      completionCountByMemberId.set(row.memberId, (completionCountByMemberId.get(row.memberId) ?? 0) + 1);
    }

    const outstandingCountByMemberId = new Map<string, number>();
    for (const chore of choreRows) {
      if (!chore.assignedTo) continue;
      outstandingCountByMemberId.set(chore.assignedTo, (outstandingCountByMemberId.get(chore.assignedTo) ?? 0) + 1);
    }

    const starsEarnedByMemberId = new Map<string, number>();
    for (const reward of rewardRows) {
      if (reward.stars <= 0) continue;
      starsEarnedByMemberId.set(reward.memberId, (starsEarnedByMemberId.get(reward.memberId) ?? 0) + reward.stars);
    }

    return insightsChoresResponseSchema.parse({
      windowDays: CHORE_WINDOW_DAYS,
      members: memberRows.map((member) => ({
        memberId: member.id,
        name: member.displayName,
        role: member.role,
        completedCount: completionCountByMemberId.get(member.id) ?? 0,
        outstandingCount: outstandingCountByMemberId.get(member.id) ?? 0,
        starsEarned: starsEarnedByMemberId.get(member.id) ?? 0
      }))
    });
  });

  app.get("/busyness", async (request, reply) => {
    const { familyId } = paramsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership || reply.sent) return;

    const now = new Date();
    const windowEnd = addDays(now, BUSYNESS_WINDOW_DAYS);
    const [futureEvents, futureEventMembers, memberRows] = await Promise.all([
      db.query.events.findMany({
        where: and(eq(events.familyId, familyId), gte(events.startAt, now), lte(events.startAt, windowEnd))
      }),
      db.query.eventMembers.findMany(),
      db.query.familyMembers.findMany({
        where: eq(familyMembers.familyId, familyId)
      })
    ]);

    const relevantEventIds = new Set(futureEvents.map((event) => event.id));
    const dayCounts = new Map<string, number>();
    for (const event of futureEvents) {
      const dayLabel = event.startAt.toLocaleDateString("en-US", { weekday: "short" });
      dayCounts.set(dayLabel, (dayCounts.get(dayLabel) ?? 0) + 1);
    }

    const memberEventCountById = new Map<string, number>();
    for (const eventMember of futureEventMembers) {
      if (!relevantEventIds.has(eventMember.eventId)) continue;
      memberEventCountById.set(eventMember.memberId, (memberEventCountById.get(eventMember.memberId) ?? 0) + 1);
    }

    return insightsBusynessResponseSchema.parse({
      windowDays: BUSYNESS_WINDOW_DAYS,
      days: Array.from(dayCounts.entries())
        .map(([dayLabel, eventCount]) => ({ dayLabel, eventCount }))
        .sort((left, right) => right.eventCount - left.eventCount || left.dayLabel.localeCompare(right.dayLabel)),
      members: memberRows
        .map((member) => ({
          memberId: member.id,
          name: member.displayName,
          eventCount: memberEventCountById.get(member.id) ?? 0
        }))
        .filter((member) => member.eventCount > 0)
        .sort((left, right) => right.eventCount - left.eventCount || left.name.localeCompare(right.name))
    });
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}
