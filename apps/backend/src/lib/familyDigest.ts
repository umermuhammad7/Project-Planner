import { and, eq, gte } from "drizzle-orm";

import { db } from "../db/client.js";
import { chores, events, familyMembers, mealPlanItems, mealPlans, notifications } from "../db/schema.js";

export async function buildDailyDigest(familyId: string, userId?: string) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const weekStart = startOfWeek(now);

  const [familyEventRows, choreRows, memberRows, mealPlan, mealItems, unreadNotifications] = await Promise.all([
    db.query.events.findMany({
      where: and(eq(events.familyId, familyId), gte(events.startAt, now))
    }),
    db.query.chores.findMany({
      where: and(eq(chores.familyId, familyId), eq(chores.isActive, true))
    }),
    db.query.familyMembers.findMany({
      where: eq(familyMembers.familyId, familyId)
    }),
    db.query.mealPlans.findFirst({
      where: and(eq(mealPlans.familyId, familyId), eq(mealPlans.weekStart, weekStart))
    }),
    db.query.mealPlanItems.findMany(),
    userId
      ? db.query.notifications.findMany({
          where: and(eq(notifications.familyId, familyId), eq(notifications.userId, userId))
        })
      : Promise.resolve([])
  ]);

  const upcomingEvents = familyEventRows.filter((event) => event.startAt <= endOfDay);
  const plannedMeals = mealPlan ? mealItems.filter((item) => item.planId === mealPlan.id) : [];

  const lines: string[] = [];
  if (upcomingEvents.length > 0) {
    lines.push(
      upcomingEvents
        .slice(0, 3)
        .map((event) => `${event.title} at ${event.startAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`)
        .join(" • ")
    );
  }
  if (choreRows.length > 0) {
    lines.push(`${choreRows.length} open chore${choreRows.length === 1 ? "" : "s"} still need attention.`);
  }
  if (plannedMeals.length > 0) {
    lines.push(`${plannedMeals.length} meal${plannedMeals.length === 1 ? "" : "s"} planned for this week.`);
  }
  if (memberRows.length > 0) {
    lines.push(`${memberRows.length} family member${memberRows.length === 1 ? "" : "s"} active in HomeThread.`);
  }
  if (userId && unreadNotifications.length > 0) {
    lines.push(`${unreadNotifications.length} earlier notification${unreadNotifications.length === 1 ? "" : "s"} are still unread.`);
  }

  return {
    familyId,
    title: "Daily family digest",
    body:
      lines.join(" ") ||
      "HomeThread is quiet right now. No urgent events, chores, or dinner changes are lined up for today.",
    upcomingEvents: upcomingEvents.length,
    openChores: choreRows.length,
    dinnersPlanned: plannedMeals.filter((item) => item.mealType === "dinner").length
  };
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}
