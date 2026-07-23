import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "../src/db/client.js";
import { childDevices, users } from "../src/db/schema.js";
import { deliverHouseholdNotification } from "../src/lib/pushNotifications.js";

const devUserId = "00000000-0000-4000-8000-000000000001";
const maraMemberId = "00000000-0000-4000-8000-000000000101";
const julesMemberId = "00000000-0000-4000-8000-000000000102";
const parkerFamilyId = "00000000-0000-4000-8000-000000000201";

describe("household notification routing", () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "ok" } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await db
      .update(users)
      .set({
        pushToken: "ExponentPushToken[adult-test]",
        notificationPrefs: {
          notifications_enabled: true,
          daily_digest: true,
          event_reminders: true,
          chore_reminders: true,
          family_activity: true
        }
      })
      .where(eq(users.id, devUserId));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.update(users).set({ pushToken: null }).where(eq(users.id, devUserId));
    await db.delete(childDevices).where(eq(childDevices.memberId, julesMemberId));
  });

  it("routes daily digest to adults only", async () => {
    await db.insert(childDevices).values({
      familyId: parkerFamilyId,
      memberId: julesMemberId,
      deviceToken: "child-token-for-digest-test",
      pushToken: "ExponentPushToken[child-digest-test]"
    });

    const delivery = await deliverHouseholdNotification({
      familyId: parkerFamilyId,
      title: "Daily family digest",
      body: "Two events today.",
      type: "daily_digest"
    });

    expect(delivery.adultNotificationsCreated).toBe(1);
    expect(delivery.adultDelivered).toBe(1);
    expect(delivery.childDelivered).toBe(0);
    expect(delivery.childDevicesTargeted).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("ExponentPushToken[adult-test]");
  });

  it("routes chore reminders to a paired child device", async () => {
    await db.insert(childDevices).values({
      familyId: parkerFamilyId,
      memberId: julesMemberId,
      deviceToken: "child-token-chore-test",
      pushToken: "ExponentPushToken[child-chore-test]"
    });

    const delivery = await deliverHouseholdNotification({
      familyId: parkerFamilyId,
      title: "Chore reminder",
      body: "Unload dishwasher is due today.",
      type: "chore_reminder",
      targetMemberIds: [julesMemberId]
    });

    expect(delivery.childDevicesTargeted).toBe(1);
    expect(delivery.childDelivered).toBe(1);
    expect(delivery.adultNotificationsCreated).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("ExponentPushToken[child-chore-test]");
  });

  it("routes mixed household event reminders to adult and child targets", async () => {
    await db.insert(childDevices).values({
      familyId: parkerFamilyId,
      memberId: julesMemberId,
      deviceToken: "child-token-event-test",
      pushToken: "ExponentPushToken[child-event-test]"
    });

    const delivery = await deliverHouseholdNotification({
      familyId: parkerFamilyId,
      title: "Coming up: School pickup",
      body: "School pickup starts at 3:10 PM.",
      type: "event_reminder",
      targetMemberIds: [maraMemberId, julesMemberId]
    });

    expect(delivery.adultNotificationsCreated).toBe(1);
    expect(delivery.adultDelivered).toBe(1);
    expect(delivery.childDevicesTargeted).toBe(1);
    expect(delivery.childDelivered).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const pushTargets = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).to);
    expect(pushTargets).toEqual(
      expect.arrayContaining(["ExponentPushToken[adult-test]", "ExponentPushToken[child-event-test]"])
    );
  });

  it("suppresses all adult delivery when the master notifications toggle is off", async () => {
    await db
      .update(users)
      .set({
        notificationPrefs: {
          notifications_enabled: false,
          daily_digest: true,
          event_reminders: true,
          chore_reminders: true,
          family_activity: true
        }
      })
      .where(eq(users.id, devUserId));

    const delivery = await deliverHouseholdNotification({
      familyId: parkerFamilyId,
      title: "Daily family digest",
      body: "Two events today.",
      type: "daily_digest"
    });

    expect(delivery.adultNotificationsCreated).toBe(0);
    expect(delivery.adultDelivered).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a stale push token when Expo reports DeviceNotRegistered", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            status: "error",
            message: "not a registered push notification recipient",
            details: { error: "DeviceNotRegistered" }
          }
        })
    });

    const delivery = await deliverHouseholdNotification({
      familyId: parkerFamilyId,
      title: "Daily family digest",
      body: "Two events today.",
      type: "daily_digest"
    });

    expect(delivery.adultDelivered).toBe(0);
    expect(delivery.adultNotificationsCreated).toBe(1);

    const updatedUser = await db.query.users.findFirst({ where: eq(users.id, devUserId) });
    expect(updatedUser?.pushToken).toBeNull();
  });
});
