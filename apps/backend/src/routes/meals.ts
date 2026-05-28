import { mealWeekQuerySchema, saveMealPlanSchema, uuidSchema } from "@homethread/shared";
import { and, asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { mealPlanItems, mealPlans } from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

export async function mealsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const query = mealWeekQuerySchema.parse(request.query);
    const weekStart = query.weekStart ?? currentWeekStart();
    const plan = await db.query.mealPlans.findFirst({
      where: and(eq(mealPlans.familyId, familyId), eq(mealPlans.weekStart, weekStart))
    });

    if (!plan) {
      return { weekStart, items: [] };
    }

    const items = await db.query.mealPlanItems.findMany({
      where: eq(mealPlanItems.planId, plan.id),
      orderBy: [asc(mealPlanItems.dayOfWeek), asc(mealPlanItems.mealType)]
    });

    return {
      weekStart,
      items
    };
  });

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = saveMealPlanSchema.parse(request.body);

    const plan = await db.transaction(async (tx) => {
      const existing = await tx.query.mealPlans.findFirst({
        where: and(eq(mealPlans.familyId, familyId), eq(mealPlans.weekStart, body.weekStart))
      });

      const ensuredPlan =
        existing ??
        (
          await tx
            .insert(mealPlans)
            .values({
              familyId,
              weekStart: body.weekStart,
              createdBy: currentUser.id
            })
            .returning()
        )[0];

      await tx.delete(mealPlanItems).where(eq(mealPlanItems.planId, ensuredPlan.id));

      if (body.items.length > 0) {
        await tx.insert(mealPlanItems).values(
          body.items.map((item) => ({
            planId: ensuredPlan.id,
            recipeId: item.recipeId ?? null,
            dayOfWeek: item.dayOfWeek,
            mealType: item.mealType,
            customTitle: item.customTitle ?? null,
            notes: item.notes ?? null
          }))
        );
      }

      return ensuredPlan;
    });

    const items = await db.query.mealPlanItems.findMany({
      where: eq(mealPlanItems.planId, plan.id),
      orderBy: [asc(mealPlanItems.dayOfWeek), asc(mealPlanItems.mealType)]
    });

    return reply.status(201).send({
      weekStart: body.weekStart,
      items
    });
  });
}

function currentWeekStart() {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}
