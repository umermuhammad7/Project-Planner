import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const originalOpenAiKey = env.OPENAI_API_KEY;
const originalGroq1 = env.GROQ_API_KEY_1;
const originalGroq2 = env.GROQ_API_KEY_2;
const originalGroq3 = env.GROQ_API_KEY_3;

describe("ai routes", () => {
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

  it("requires bearer tokens for assistant routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/assist",
      payload: { message: "Buy milk" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Missing bearer token",
      code: "AUTH_REQUIRED"
    });
  });

  it("returns local mode when no providers are configured", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/assist",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        message: "Buy milk and eggs"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "local",
      provider: null,
      message: "AI assistant is not configured on this backend. HomeThread will use local parsing instead.",
      draft: null,
      recipe: null
    });
  });

  it("uses OpenAI first and returns structured assistant output", async () => {
    env.OPENAI_API_KEY = "test-openai-key";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Added those groceries to your list draft.",
                  draft: {
                    kind: "list",
                    title: "Milk and eggs",
                    detail: "Shopping list",
                    confidence: 0.91,
                    rawText: "Buy milk and eggs"
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
      url: "/api/v1/ai/assist",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        message: "Buy milk and eggs",
        intent: "grocery_list"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      mode: "ai",
      provider: "openai",
      message: "Added those groceries to your list draft.",
      draft: {
        kind: "list",
        title: "Milk and eggs"
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.openai.com");
  });

  it("passes family context through to the provider prompt", async () => {
    env.OPENAI_API_KEY = "test-openai-key";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Today looks busy but manageable.",
                  draft: null
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
      url: "/api/v1/ai/assist",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        message: "What's on today?",
        intent: "day_summary",
        context: {
          familyName: "Parker Home",
          today: "Friday",
          members: ["Mara", "Jules"],
          upcomingEvents: [{ title: "Soccer practice", time: "5:00 PM", dateLabel: "Today" }],
          openChores: [{ title: "Unload dishwasher", dueLabel: "Tonight" }]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain("Family: Parker Home.");
    expect(body.messages[0].content).toContain("Upcoming events: Today 5:00 PM: Soccer practice");
    expect(body.messages[0].content).toContain("Open chores: Unload dishwasher (Tonight).");
  });

  it("falls back to the next configured provider when OpenAI fails", async () => {
    env.OPENAI_API_KEY = "test-openai-key";
    env.GROQ_API_KEY_1 = "test-groq-key";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    reply: "Here is a chore draft.",
                    draft: {
                      kind: "chore",
                      title: "Unload dishwasher",
                      detail: "Ready to assign",
                      confidence: 0.88,
                      rawText: "Remind Jules to unload dishwasher tonight"
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
      url: "/api/v1/ai/assist",
      headers: {
        Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
      },
      payload: {
        message: "Remind Jules to unload dishwasher tonight",
        intent: "chores"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      mode: "ai",
      provider: "groq-1",
      draft: {
        kind: "chore",
        title: "Unload dishwasher"
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("api.groq.com");
  });
});
