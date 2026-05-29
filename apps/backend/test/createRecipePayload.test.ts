import { describe, expect, it } from "vitest";

import { buildCreateRecipeRequestBody } from "@homethread/shared";

describe("buildCreateRecipeRequestBody", () => {
  it("preserves imported instructions, timings, and servings in the save payload", () => {
    const payload = buildCreateRecipeRequestBody({
      title: "  Weeknight tacos  ",
      description: " Family favorite ",
      ingredients: [{ name: "ground beef", amount: "1", unit: "lb" }],
      instructions: [{ step: 1, text: "Cook beef and assemble tacos." }],
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      servings: 4
    });

    expect(payload).toEqual({
      title: "Weeknight tacos",
      description: "Family favorite",
      ingredients: [{ name: "ground beef", amount: "1", unit: "lb" }],
      instructions: [{ step: 1, text: "Cook beef and assemble tacos." }],
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      servings: 4
    });
  });

  it("omits optional fields when they are not present", () => {
    const payload = buildCreateRecipeRequestBody({
      title: "Simple salad",
      ingredients: [{ name: "lettuce" }]
    });

    expect(payload).toEqual({
      title: "Simple salad",
      description: null,
      ingredients: [{ name: "lettuce" }]
    });
    expect(payload.instructions).toBeUndefined();
    expect(payload.prepTimeMinutes).toBeUndefined();
    expect(payload.cookTimeMinutes).toBeUndefined();
    expect(payload.servings).toBeUndefined();
  });
});
