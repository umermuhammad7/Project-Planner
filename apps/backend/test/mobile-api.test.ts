import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../mobile/src/services/api.js";

describe("mobile api request headers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send a JSON content type for requests without a body", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200
    }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/empty-post", { method: "POST" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).not.toMatchObject({
      "Content-Type": "application/json"
    });
  });

  it("adds a JSON content type when a JSON body is present", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200
    }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/json-post", {
      body: JSON.stringify({ ok: true }),
      method: "POST"
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json"
    });
  });
});
