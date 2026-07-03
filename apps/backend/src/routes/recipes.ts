import { createRecipeSchema, updateRecipeSchema, uuidSchema } from "@homethread/shared";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { mealPlanItems, recipes } from "../db/schema.js";
import { sendError } from "../lib/http.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

const recipeParamsSchema = familyParamsSchema.extend({
  recipeId: uuidSchema
});

function mapRecipe(recipe: typeof recipes.$inferSelect) {
  return {
    id: recipe.id,
    familyId: recipe.familyId,
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    servings: recipe.servings,
    isFavorite: recipe.isFavorite,
    createdAt: recipe.createdAt
  };
}

export async function recipesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const familyRecipes = await db.query.recipes.findMany({
      where: eq(recipes.familyId, familyId),
      orderBy: [asc(recipes.title)]
    });

    return {
      recipes: familyRecipes.map(mapRecipe)
    };
  });

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = createRecipeSchema.parse(request.body);
    const [recipe] = await db
      .insert(recipes)
      .values({
        familyId,
        title: body.title,
        description: body.description ?? null,
        ingredients: body.ingredients,
        instructions: body.instructions ?? [],
        prepTimeMinutes: body.prepTimeMinutes ?? null,
        cookTimeMinutes: body.cookTimeMinutes ?? null,
        servings: body.servings ?? null,
        createdBy: currentUser.id
      })
      .returning();

    return reply.status(201).send({ recipe });
  });

  app.patch("/:recipeId", async (request, reply) => {
    const { familyId, recipeId } = recipeParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const existing = await db.query.recipes.findFirst({
      where: and(eq(recipes.familyId, familyId), eq(recipes.id, recipeId))
    });

    if (!existing) {
      return sendError(reply, 404, "Recipe not found", "RECIPE_NOT_FOUND");
    }

    const body = updateRecipeSchema.parse(request.body);
    const [recipe] = await db
      .update(recipes)
      .set({
        title: body.title,
        description: body.description,
        ingredients: body.ingredients,
        instructions: body.instructions,
        prepTimeMinutes: body.prepTimeMinutes,
        cookTimeMinutes: body.cookTimeMinutes,
        servings: body.servings
      })
      .where(and(eq(recipes.familyId, familyId), eq(recipes.id, recipeId)))
      .returning();

    return { recipe };
  });

  app.delete("/:recipeId", async (request, reply) => {
    const { familyId, recipeId } = recipeParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const existing = await db.query.recipes.findFirst({
      where: and(eq(recipes.familyId, familyId), eq(recipes.id, recipeId))
    });

    if (!existing) {
      return sendError(reply, 404, "Recipe not found", "RECIPE_NOT_FOUND");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(mealPlanItems)
        .set({ customTitle: existing.title })
        .where(
          and(
            eq(mealPlanItems.recipeId, recipeId),
            or(isNull(mealPlanItems.customTitle), eq(mealPlanItems.customTitle, ""))
          )
        );

      await tx.delete(recipes).where(and(eq(recipes.familyId, familyId), eq(recipes.id, recipeId)));
    });

    return { deleted: true };
  });
}
