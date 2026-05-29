import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const originalOpenAiKey = env.OPENAI_API_KEY;
const originalGroq1 = env.GROQ_API_KEY_1;
const originalGroq2 = env.GROQ_API_KEY_2;
const originalGroq3 = env.GROQ_API_KEY_3;

describe("ai meal-suggest route", () => {
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
      url: "/api/v1/ai/meal-suggest",
      payload: { message: "Plan dinners this week" }
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns local mode with no suggestions when providers are missing", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/meal-suggest",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        message: "Suggest simple dinners for our family this week."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "local",
      provider: null,
      message: "AI meal suggestions are not configured on this backend.",
      suggestions: null
    });
  });

  it("returns structured meal suggestions from AI", async () => {
    env.OPENAI_API_KEY = "test-openai-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Here are five easy dinners for the week.",
                  suggestions: [
                    { dayOfWeek: 0, mealType: "dinner", title: "Sheet-pan chicken", notes: "Use what you have" },
                    { dayOfWeek: 1, mealType: "dinner", title: "Taco night", notes: null },
                    { dayOfWeek: 2, mealType: "dinner", title: "Pasta primavera", notes: null }
                  ]
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
      url: "/api/v1/ai/meal-suggest",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        message: "Suggest simple dinners for our family this week.",
        dinnerCount: 5
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.mode).toBe("ai");
    expect(body.provider).toBe("openai");
    expect(body.message).toBe("Here are five easy dinners for the week.");
    expect(body.suggestions).toHaveLength(3);
    expect(body.suggestions?.[0]).toMatchObject({
      dayOfWeek: 0,
      mealType: "dinner",
      title: "Sheet-pan chicken",
      notes: "Use what you have"
    });
  });
});
