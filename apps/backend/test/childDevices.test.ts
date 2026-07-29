import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from "vitest";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { childDevices, childPairingAttempts, familyMembers } from "../src/db/schema.js";
import { deliverHouseholdNotification } from "../src/lib/pushNotifications.js";
import { env } from "../src/env.js";
import { and, eq, isNull, sql } from "drizzle-orm";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";
const julesMemberId = "00000000-0000-4000-8000-000000000102";
const devUserId = "00000000-0000-4000-8000-000000000001";

async function downgradeDevToMember(familyId: string) {
  await db
    .update(familyMembers)
    .set({ role: "member" })
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, devUserId)));
}

async function createPairingCode() {
  const app = buildApp();
  const pairingResponse = await app.inject({
    method: "POST",
    url: `/api/v1/families/${parkerFamilyId}/members/${julesMemberId}/child-pairing-code`,
    headers: authHeaders
  });

  expect(pairingResponse.statusCode).toBe(201);
  return pairingResponse.json().pairingCode as string;
}

async function pairDevice(pairingCode: string) {
  const app = buildApp();
  const pairResponse = await app.inject({
    method: "POST",
    url: "/api/v1/child-devices/pair",
    payload: {
      pairingCode
    }
  });

  return pairResponse;
}

describe("child device routes", () => {
  beforeAll(async () => {
    await db.execute(sql`
      create table if not exists child_pairing_attempts (
        client_key text primary key,
        failure_count integer not null default 0,
        reset_at timestamp with time zone not null,
        created_at timestamp with time zone not null default now(),
        updated_at timestamp with time zone not null default now()
      )
    `);
  });

  beforeEach(async () => {
    await db.delete(childPairingAttempts);
  });

  afterEach(async () => {
    await db.delete(childPairingAttempts);
  });

  it("rejects adult join attempts that use a child pairing code", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/families/join",
      headers: authHeaders,
      payload: {
        inviteCode: "KC-ABC123"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "ADULT_INVITE_REQUIRED"
    });
  });

  it("rejects adult invite codes on the child pairing route", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/child-devices/pair",
      payload: {
        pairingCode: "HT2026"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toMatch(/CHILD_PAIRING_CODE_REQUIRED|VALIDATION_ERROR/u);

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/v1/child-devices/pair/preview",
      payload: {
        pairingCode: "HT2026"
      }
    });

    expect(previewResponse.statusCode).toBe(400);
    expect(previewResponse.json().code).toMatch(/CHILD_PAIRING_CODE_REQUIRED|VALIDATION_ERROR/u);
  });

  it("blocks repeated failed child pairing attempts across preview and pair routes", async () => {
    const app = buildApp();
    const headers = {
      "x-forwarded-for": "203.0.113.42"
    };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const previewResponse = await app.inject({
        method: "POST",
        url: "/api/v1/child-devices/pair/preview",
        headers,
        payload: {
          pairingCode: "KC-AAAAAA"
        }
      });

      expect(previewResponse.statusCode).toBe(400);
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const pairResponse = await app.inject({
        method: "POST",
        url: "/api/v1/child-devices/pair",
        headers,
        payload: {
          pairingCode: "KC-BBBBBB"
        }
      });

      expect(pairResponse.statusCode).toBe(400);
    }

    const blockedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/child-devices/pair",
      headers,
      payload: {
        pairingCode: "KC-CCCCCC"
      }
    });

    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.json()).toMatchObject({
      code: "CHILD_PAIRING_RATE_LIMITED"
    });
  });

  it("returns a specific readiness error when child pairing tables are unavailable", async () => {
    const app = buildApp();
    const querySpy = vi
      .spyOn(db.query.childPairingCodes, "findFirst")
      .mockRejectedValueOnce(Object.assign(new Error('relation "child_pairing_codes" does not exist'), { code: "42P01" }));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/child-devices/pair",
      payload: {
        pairingCode: "KC-ABC123"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "CHILD_PAIRING_NOT_READY"
    });

    querySpy.mockRestore();
  });

  it("rejects adult bearer tokens on child device routes", async () => {
    const pairingCode = await createPairingCode();
    const pairResponse = await pairDevice(pairingCode);
    expect(pairResponse.statusCode).toBe(201);

    const app = buildApp();
    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/child-devices/me",
      headers: authHeaders
    });

    expect(meResponse.statusCode).toBe(401);
    expect(meResponse.json()).toMatchObject({
      code: "CHILD_DEVICE_AUTH_REQUIRED"
    });
  });

  it("creates a child pairing code for a child profile and pairs a device", async () => {
    const pairingCode = await createPairingCode();
    expect(pairingCode).toMatch(/^KC-[A-Z0-9]{6}$/u);

    const app = buildApp();
    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${parkerFamilyId}/child-pairing-codes`,
      headers: authHeaders
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      pairingCodes: [
        {
          pairingCode,
          memberId: julesMemberId,
          memberName: "Jules"
        }
      ]
    });
    expect(listResponse.json().pairingCodes[0]?.expiresAt).toBeTruthy();

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/v1/child-devices/pair/preview",
      payload: {
        pairingCode
      }
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json()).toMatchObject({
      pairingCode,
      family: {
        id: parkerFamilyId
      },
      member: {
        id: julesMemberId,
        displayName: "Jules"
      }
    });

    const pairResponse = await pairDevice(pairingCode);
    expect(pairResponse.statusCode).toBe(201);
    const deviceToken = pairResponse.json().deviceToken as string;
    expect(deviceToken.length).toBeGreaterThan(20);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/child-devices/me",
      headers: {
        Authorization: `ChildDevice ${deviceToken}`
      }
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      member: {
        id: julesMemberId,
        displayName: "Jules"
      }
    });
  });

  it("revokes the previous active device when pairing again for the same child", async () => {
    const firstCode = await createPairingCode();
    const firstPair = await pairDevice(firstCode);
    expect(firstPair.statusCode).toBe(201);
    const firstToken = firstPair.json().deviceToken as string;

    const secondCode = await createPairingCode();
    const secondPair = await pairDevice(secondCode);
    expect(secondPair.statusCode).toBe(201);
    const secondToken = secondPair.json().deviceToken as string;
    expect(secondToken).not.toBe(firstToken);

    const app = buildApp();
    const oldDeviceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/child-devices/me",
      headers: {
        Authorization: `ChildDevice ${firstToken}`
      }
    });
    expect(oldDeviceResponse.statusCode).toBe(401);

    const activeDevices = await db.query.childDevices.findMany({
      where: and(
        eq(childDevices.familyId, parkerFamilyId),
        eq(childDevices.memberId, julesMemberId),
        isNull(childDevices.revokedAt)
      )
    });
    expect(activeDevices).toHaveLength(1);
    expect(activeDevices[0]?.deviceToken).toBe(secondToken);
  });
  it("lets a plain household member generate a pairing code, list it, and unpair a device", async () => {
    const app = buildApp();
    const createFamilyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/families",
      headers: authHeaders,
      payload: { name: "Member Pairing Test Home" }
    });
    expect(createFamilyResponse.statusCode).toBe(201);
    const familyId = createFamilyResponse.json().family.id as string;

    const createChildResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/members`,
      headers: authHeaders,
      payload: {
        displayName: "Test Kid",
        color: "#F9735B",
        role: "child",
        isVirtual: true
      }
    });
    expect(createChildResponse.statusCode).toBe(201);
    const childMemberId = createChildResponse.json().member.id as string;

    await downgradeDevToMember(familyId);

    const codeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/families/${familyId}/members/${childMemberId}/child-pairing-code`,
      headers: authHeaders
    });
    expect(codeResponse.statusCode).toBe(201);
    const pairingCode = codeResponse.json().pairingCode as string;

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/families/${familyId}/child-pairing-codes`,
      headers: authHeaders
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      pairingCodes: [{ pairingCode, memberId: childMemberId }]
    });

    const pairResponse = await pairDevice(pairingCode);
    expect(pairResponse.statusCode).toBe(201);
    const device = await db.query.childDevices.findFirst({
      where: and(eq(childDevices.familyId, familyId), eq(childDevices.memberId, childMemberId))
    });
    expect(device).toBeTruthy();

    const unpairResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/families/${familyId}/child-devices/${device!.id}`,
      headers: authHeaders
    });
    expect(unpairResponse.statusCode).toBe(200);
    expect(unpairResponse.json()).toEqual({ revoked: true });
  });
});

describe("household notification delivery", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "ok" } })
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delivers chore reminders to a paired child device", async () => {
    const pairingCode = await createPairingCode();
    const pairResponse = await pairDevice(pairingCode);
    const deviceToken = pairResponse.json().deviceToken as string;

    const app = buildApp();
    await app.inject({
      method: "PUT",
      url: "/api/v1/child-devices/push-token",
      headers: {
        Authorization: `ChildDevice ${deviceToken}`
      },
      payload: {
        pushToken: "ExponentPushToken[child-device-test]"
      }
    });

    const delivery = await deliverHouseholdNotification({
      familyId: parkerFamilyId,
      title: "Chore reminder",
      body: "Tidy room is due today.",
      type: "chore_reminder",
      targetMemberIds: [julesMemberId]
    });

    expect(delivery.childDevicesTargeted).toBe(1);
    expect(delivery.childDelivered).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });
});
