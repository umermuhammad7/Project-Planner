import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";
import { parseRecipeTextLocally } from "../src/lib/recipeImport.js";

const originalOpenAiKey = env.OPENAI_API_KEY;
const originalGroq1 = env.GROQ_API_KEY_1;
const originalGroq2 = env.GROQ_API_KEY_2;
const originalGroq3 = env.GROQ_API_KEY_3;

describe("ai recipe-import route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    env.OPENAI_API_KEY = undefined;
    env.GROQ_API_KEY_1 = undefined;
    env.GROQ_API_KEY_2 = undefined;
    env.GROQ_API_KEY_3 = undefined;
  });

  afterEach(() => {
    env.OPENAI_API_KEY = originalOpenAiKey;
    env.GROQ_API_KEY_1 = originalGroq1;
    env.GROQ_API_KEY_2 = originalGroq2;
    env.GROQ_API_KEY_3 = originalGroq3;
  });

  it("requires bearer tokens", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/recipe-import",
      payload: { source: "text", text: "Tacos\nbeef\ntortillas" }
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns a truthful response for URL import without fetching pages", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/recipe-import",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        source: "url",
        url: "https://example.com/recipes/tacos"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "local",
      provider: null,
      message:
        "HomeThread does not fetch recipe web pages in this build. Copy the recipe text and use paste import instead.",
      source: "url",
      recipe: null
    });
  });

  it("falls back to local text parsing when AI is unavailable", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/recipe-import",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        source: "text",
        text: "Sheet-pan chicken\nchicken thighs\nolive oil\nbroccoli"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      mode: "local",
      provider: null,
      source: "text",
      recipe: {
        title: "Sheet-pan chicken",
        ingredients: [{ name: "chicken thighs" }, { name: "olive oil" }, { name: "broccoli" }]
      }
    });
  });

  it("returns structured recipes from AI for pasted text", async () => {
    env.OPENAI_API_KEY = "test-openai-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Parsed your taco recipe.",
                  recipe: {
                    title: "Weeknight tacos",
                    description: null,
                    ingredients: [
                      { name: "ground beef", amount: "1", unit: "lb" },
                      { name: "tortillas", amount: null, unit: null }
                    ],
                    instructions: [{ step: 1, text: "Cook beef and assemble tacos." }],
                    prepTimeMinutes: 10,
                    cookTimeMinutes: 20,
                    servings: 4
                  }
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/recipe-import",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        source: "text",
        text: "Weeknight tacos\n1 lb ground beef\ntortillas"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.mode).toBe("ai");
    expect(body.provider).toBe("openai");
    expect(body.source).toBe("text");
    expect(body.message).toBe("Parsed your taco recipe.");
    expect(body.recipe?.title).toBe("Weeknight tacos");
    expect(body.recipe?.ingredients).toHaveLength(2);
    expect(body.recipe?.ingredients?.[0]).toMatchObject({
      name: "ground beef",
      amount: "1",
      unit: "lb"
    });
    expect(body.recipe?.instructions).toEqual([{ step: 1, text: "Cook beef and assemble tacos." }]);
    expect(body.recipe?.prepTimeMinutes).toBe(10);
    expect(body.recipe?.cookTimeMinutes).toBe(20);
    expect(body.recipe?.servings).toBe(4);
  });
});

describe("parseRecipeTextLocally", () => {
  it("returns null when text is too short", () => {
    expect(parseRecipeTextLocally("Only a title")).toBeNull();
  });
});
