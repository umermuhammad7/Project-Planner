import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const familyId = "00000000-0000-4000-8000-000000000201";

describe("recipes route", () => {
  it("requires bearer tokens for family recipe routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/recipes`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Missing bearer token",
      code: "AUTH_REQUIRED"
    });
  });

  it("supports saved recipe create, edit, meal reuse, and delete lifecycle", async () => {
    const app = buildApp();
    const weekStart = "2026-07-13";

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/recipes`,
      headers: authHeaders,
      payload: {
        title: "AW153 Lifecycle Recipe",
        ingredients: [{ name: "salt" }]
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const recipeId = createResponse.json().recipe.id as string;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/families/${familyId}/recipes/${recipeId}`,
      headers: authHeaders,
      payload: {
        title: "AW153 Lifecycle Recipe Updated",
        ingredients: [{ name: "salt" }, { name: "pepper" }]
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().recipe).toMatchObject({
      id: recipeId,
      title: "AW153 Lifecycle Recipe Updated"
    });

    const mealResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/meals`,
      headers: authHeaders,
      payload: {
        weekStart,
        items: [
          {
            dayOfWeek: 1,
            mealType: "dinner",
            customTitle: null,
            notes: null,
            recipeId
          }
        ]
      }
    });

    expect(mealResponse.statusCode).toBe(201);
    expect(mealResponse.json().items[0]).toMatchObject({
      recipeId,
      recipeTitle: "AW153 Lifecycle Recipe Updated"
    });

    const mealsListResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/meals?weekStart=${weekStart}`,
      headers: authHeaders
    });

    expect(mealsListResponse.statusCode).toBe(200);
    expect(mealsListResponse.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipeId,
          recipeTitle: "AW153 Lifecycle Recipe Updated"
        })
      ])
    );

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyId}/recipes/${recipeId}`,
      headers: authHeaders
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ deleted: true });

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/recipes`,
      headers: authHeaders
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().recipes.find((recipe: { id: string }) => recipe.id === recipeId)).toBeUndefined();

    const mealsAfterDelete = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/meals?weekStart=${weekStart}`,
      headers: authHeaders
    });

    expect(mealsAfterDelete.statusCode).toBe(200);
    const linkedMeal = mealsAfterDelete.json().items.find(
      (item: { dayOfWeek: number; mealType: string }) => item.dayOfWeek === 1 && item.mealType === "dinner"
    );
    expect(linkedMeal).toMatchObject({
      recipeId: null,
      customTitle: "AW153 Lifecycle Recipe Updated",
      recipeTitle: null
    });

    await app.close();
  });
});
