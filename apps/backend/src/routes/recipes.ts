import { createRecipeSchema, uuidSchema } from "@homethread/shared";
import { asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { recipes } from "../db/schema.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

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
      recipes: familyRecipes.map((recipe) => ({
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
      }))
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
}
