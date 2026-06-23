import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { childDevices } from "../src/db/schema.js";
import { deliverHouseholdNotification } from "../src/lib/pushNotifications.js";
import { env } from "../src/env.js";
import { and, eq, isNull } from "drizzle-orm";

const authHeaders = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

const parkerFamilyId = "00000000-0000-4000-8000-000000000201";
const julesMemberId = "00000000-0000-4000-8000-000000000102";

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

    const pairResponse = await pairDevice(pairingCode);
    expect(pairResponse.statusCode).toBe(201);
    const deviceToken = pairResponse.json().deviceToken as string;
    expect(deviceToken.length).toBeGreaterThan(20);

    const app = buildApp();
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
});

describe("household notification delivery", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true });
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
