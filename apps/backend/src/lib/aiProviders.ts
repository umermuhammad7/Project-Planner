import { env } from "../env.js";

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ProviderAttempt = {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ProviderCompletionResult =
  | { ok: true; provider: string; content: string }
  | { ok: false; reason: string; attempts: string[] };

export async function completeWithProviderFallback(
  messages: ChatMessage[]
): Promise<ProviderCompletionResult> {
  const chain = buildProviderChain();
  if (chain.length === 0) {
    return { ok: false, reason: "No AI providers configured", attempts: [] };
  }

  const attempts: string[] = [];

  for (const provider of chain) {
    const result = await callChatCompletions(provider, messages);
    if (result.ok) {
      return { ok: true, provider: provider.name, content: result.content };
    }

    attempts.push(`${provider.name}: ${result.error}`);
  }

  return { ok: false, reason: "All configured providers failed", attempts };
}

function buildProviderChain(): ProviderAttempt[] {
  const chain: ProviderAttempt[] = [];

  if (env.OPENAI_API_KEY?.trim()) {
    chain.push({
      name: "openai",
      apiKey: env.OPENAI_API_KEY.trim(),
      baseUrl: "https://api.openai.com/v1",
      model: env.OPENAI_MODEL
    });
  }

  const groqKeys = [
    { name: "groq-1", key: env.GROQ_API_KEY_1 },
    { name: "groq-2", key: env.GROQ_API_KEY_2 },
    { name: "groq-3", key: env.GROQ_API_KEY_3 }
  ];

  for (const entry of groqKeys) {
    if (entry.key?.trim()) {
      chain.push({
        name: entry.name,
        apiKey: entry.key.trim(),
        baseUrl: "https://api.groq.com/openai/v1",
        model: env.GROQ_MODEL
      });
    }
  }

  return chain;
}

async function callChatCompletions(
  provider: ProviderAttempt,
  messages: ChatMessage[]
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages,
        response_format: { type: "json_object" }
      })
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      if (response.status === 401) {
        return { ok: false, error: `auth failed (${message})` };
      }
      if (response.status === 429) {
        return { ok: false, error: `rate limited (${message})` };
      }
      return { ok: false, error: message };
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "empty completion" };
    }

    return { ok: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return { ok: false, error: message };
  }
}
