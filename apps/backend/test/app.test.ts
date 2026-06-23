import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

describe("app error handling", () => {
  it("returns a 400 for invalid JSON bodies instead of masking them as internal errors", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/child-devices/pair",
      headers: {
        "content-type": "application/json"
      },
      payload: '{"pairingCode":'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "FST_ERR_CTP_INVALID_JSON_BODY"
    });
  });
});
