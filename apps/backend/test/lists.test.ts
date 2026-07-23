import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { env } from "../src/env.js";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";

describe("lists route", () => {
  it("requires bearer tokens for family list routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/lists`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Missing bearer token",
      code: "AUTH_REQUIRED"
    });
  });

  it("deletes an existing list item", async () => {
    const app = buildApp();
    const listResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/lists`,
      headers: authHeaders,
      payload: {
        title: "AW-159 delete probe list",
        type: "todo"
      }
    });

    expect(listResponse.statusCode).toBe(201);
    const listId = listResponse.json().list.id as string;

    const itemResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/lists/${listId}/items`,
      headers: authHeaders,
      payload: {
        content: "Probe item"
      }
    });

    expect(itemResponse.statusCode).toBe(201);
    const itemId = itemResponse.json().item.id as string;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${parkerFamilyId}/lists/${listId}/items/${itemId}`,
      headers: authHeaders
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ deleted: true });
  });

  it("returns 404 when deleting a missing list item", async () => {
    const app = buildApp();
    const listResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/lists`,
      headers: authHeaders,
      payload: {
        title: "AW-159 missing item list",
        type: "todo"
      }
    });

    expect(listResponse.statusCode).toBe(201);
    const listId = listResponse.json().list.id as string;

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${parkerFamilyId}/lists/${listId}/items/00000000-0000-4000-8000-00000000a159`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "List item not found",
      code: "LIST_ITEM_NOT_FOUND"
    });
  });

  it("deletes an existing list", async () => {
    const app = buildApp();
    const listResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${parkerFamilyId}/lists`,
      headers: authHeaders,
      payload: {
        title: "AW-159 delete list probe",
        type: "todo"
      }
    });

    expect(listResponse.statusCode).toBe(201);
    const listId = listResponse.json().list.id as string;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${parkerFamilyId}/lists/${listId}`,
      headers: authHeaders
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ deleted: true });
  });

  it("returns 404 when deleting a missing list", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${parkerFamilyId}/lists/00000000-0000-4000-8000-00000000d159`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "List not found",
      code: "LIST_NOT_FOUND"
    });
  });

  it("returns 404 when deleting from a missing list", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${parkerFamilyId}/lists/00000000-0000-4000-8000-00000000b159/items/00000000-0000-4000-8000-00000000c159`,
      headers: authHeaders
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "List not found",
      code: "LIST_NOT_FOUND"
    });
  });
});
