import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";
const julesMemberId = "00000000-0000-4000-8000-000000000102";
const maraMemberId = "00000000-0000-4000-8000-000000000101";

async function createAndCompleteChore(app: ReturnType<typeof buildApp>, title: string, memberId: string, dueDate: string) {
  const choreResponse = await app.inject({
    method: "POST",
    url: `/api/v1/families/${parkerFamilyId}/chores`,
    headers: authHeaders,
    payload: {
      title,
      starsValue: 2,
      assignedTo: memberId,
      isActive: true
    }
  });

  expect(choreResponse.statusCode).toBe(201);
  const choreId = choreResponse.json().chore.id as string;

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/v1/families/${parkerFamilyId}/chores/${choreId}/complete`,
    headers: authHeaders,
    payload: {
      memberId,
      dueDate
    }
  });

  expect(completeResponse.statusCode).toBe(201);

  return choreId;
}

describe("chore history route", () => {
  it("returns completion history and supports memberId filtering", async () => {
    const app = buildApp();
    const dueDate = "2026-07-03";
    const choreId = await createAndCompleteChore(app, "AW-158 history member filter", julesMemberId, dueDate);

    const allHistory = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/chores/history`,
      headers: authHeaders
    });

    expect(allHistory.statusCode).toBe(200);
    expect(
      allHistory.json().completions.some(
        (row: { completion: { choreId: string }; chore: { id: string } }) =>
          row.completion.choreId === choreId || row.chore.id === choreId
      )
    ).toBe(true);

    const julesHistory = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/chores/history?memberId=${julesMemberId}`,
      headers: authHeaders
    });

    expect(julesHistory.statusCode).toBe(200);
    expect(julesHistory.json().completions.every((row: { completion: { memberId: string } }) => row.completion.memberId === julesMemberId)).toBe(
      true
    );
    expect(
      julesHistory.json().completions.some(
        (row: { completion: { choreId: string } }) => row.completion.choreId === choreId
      )
    ).toBe(true);

    const maraHistory = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/chores/history?memberId=${maraMemberId}&from=${dueDate}&to=${dueDate}`,
      headers: authHeaders
    });

    expect(maraHistory.statusCode).toBe(200);
    expect(
      maraHistory.json().completions.some(
        (row: { completion: { choreId: string } }) => row.completion.choreId === choreId
      )
    ).toBe(false);
  });

  it("applies from/to date filters on completedAt", async () => {
    const app = buildApp();
    const dueDate = "2026-07-04";
    const choreId = await createAndCompleteChore(app, "AW-158 history date filter", julesMemberId, dueDate);
    const today = new Date().toISOString().slice(0, 10);

    const inRangeHistory = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/chores/history?from=${today}&to=${today}`,
      headers: authHeaders
    });

    expect(inRangeHistory.statusCode).toBe(200);
    expect(
      inRangeHistory.json().completions.some(
        (row: { completion: { choreId: string } }) => row.completion.choreId === choreId
      )
    ).toBe(true);

    const futureHistory = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/chores/history?from=2099-01-01&to=2099-01-02`,
      headers: authHeaders
    });

    expect(futureHistory.statusCode).toBe(200);
    expect(futureHistory.json().completions).toEqual([]);
  });
});
