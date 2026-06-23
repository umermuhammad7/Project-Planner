import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../db/client.js";
import { childDevices, familyMembers, notifications, users } from "../db/schema.js";

type NotificationPrefs = {
  daily_digest: boolean;
  event_reminders: boolean;
  chore_reminders: boolean;
  family_activity: boolean;
};

type SendFamilyNotificationInput = {
  familyId: string;
  title: string;
  body: string;
  type: string;
  memberIds?: string[];
};

type SendChildDeviceNotificationInput = {
  familyId: string;
  memberId?: string;
  title: string;
  body: string;
  type: string;
};

type DeliverHouseholdNotificationInput = {
  familyId: string;
  title: string;
  body: string;
  type: string;
  targetMemberIds?: string[];
};

export type HouseholdNotificationDelivery = {
  adultDelivered: number;
  adultNotificationsCreated: number;
  childDelivered: number;
  childDevicesTargeted: number;
};

function shouldDeliverNotification(prefs: NotificationPrefs, type: string) {
  if (type === "daily_digest") {
    return prefs.daily_digest;
  }

  if (type === "event_reminder" || type === "travel_reminder") {
    return prefs.event_reminders;
  }

  if (type === "chore_reminder") {
    return prefs.chore_reminders;
  }

  return prefs.family_activity;
}

export async function sendNotificationToFamilyMembers(input: SendFamilyNotificationInput) {
  const members = await db.query.familyMembers.findMany({
    where: eq(familyMembers.familyId, input.familyId)
  });
  const scopedMembers = input.memberIds?.length
    ? members.filter((member) => input.memberIds!.includes(member.id))
    : members;
  const userIds = scopedMembers.map((member) => member.userId).filter((userId): userId is string => Boolean(userId));
  if (userIds.length === 0) {
    return { delivered: 0, createdNotifications: 0 };
  }

  const profiles = await db.query.users.findMany({
    where: inArray(users.id, userIds)
  });
  const familyProfiles = profiles.filter((profile) => {
    if (!profile.pushToken) {
      return false;
    }

    const prefs = profile.notificationPrefs as NotificationPrefs;
    return shouldDeliverNotification(prefs, input.type);
  });

  let delivered = 0;
  let createdNotifications = 0;

  for (const profile of familyProfiles) {
    await db.insert(notifications).values({
      userId: profile.id,
      familyId: input.familyId,
      type: input.type,
      title: input.title,
      body: input.body
    });
    createdNotifications += 1;

    const sent = await sendExpoPush(profile.pushToken!, input.title, input.body);
    if (sent) {
      delivered += 1;
    }
  }

  return { delivered, createdNotifications };
}

export async function sendNotificationToChildDevices(input: SendChildDeviceNotificationInput) {
  const devices = await db.query.childDevices.findMany({
    where: and(
      eq(childDevices.familyId, input.familyId),
      isNull(childDevices.revokedAt),
      input.memberId ? eq(childDevices.memberId, input.memberId) : undefined
    )
  });

  const activeDevices = devices.filter((device) => Boolean(device.pushToken));
  let delivered = 0;

  for (const device of activeDevices) {
    const sent = await sendExpoPush(device.pushToken!, input.title, input.body);
    if (sent) {
      delivered += 1;
    }
  }

  return { delivered, targetedDevices: activeDevices.length };
}

export async function deliverHouseholdNotification(
  input: DeliverHouseholdNotificationInput
): Promise<HouseholdNotificationDelivery> {
  if (input.type === "daily_digest") {
    const adults = await sendNotificationToFamilyMembers(input);
    return {
      adultDelivered: adults.delivered,
      adultNotificationsCreated: adults.createdNotifications,
      childDelivered: 0,
      childDevicesTargeted: 0
    };
  }

  const members = await db.query.familyMembers.findMany({
    where: eq(familyMembers.familyId, input.familyId)
  });
  const targetedMembers = input.targetMemberIds?.length
    ? members.filter((member) => input.targetMemberIds!.includes(member.id))
    : members;
  const adultMemberIds = targetedMembers
    .filter((member) => Boolean(member.userId))
    .map((member) => member.id);
  const childMemberIds = targetedMembers.filter((member) => member.role === "child").map((member) => member.id);

  let adultDelivered = 0;
  let adultNotificationsCreated = 0;
  let childDelivered = 0;
  let childDevicesTargeted = 0;

  const shouldNotifyAdults =
    input.type === "family_activity" ||
    input.type === "chore_reminder" ||
    input.type === "event_reminder" ||
    input.type === "travel_reminder";

  if (shouldNotifyAdults) {
    const adultScope =
      input.type === "chore_reminder" || input.targetMemberIds?.length ? adultMemberIds : undefined;
    if (!adultScope || adultScope.length > 0) {
      const adults = await sendNotificationToFamilyMembers({
        familyId: input.familyId,
        title: input.title,
        body: input.body,
        type: input.type,
        memberIds: adultScope
      });
      adultDelivered = adults.delivered;
      adultNotificationsCreated = adults.createdNotifications;
    }
  }

  if (
    (input.type === "chore_reminder" ||
      input.type === "event_reminder" ||
      input.type === "travel_reminder") &&
    childMemberIds.length > 0
  ) {
    for (const memberId of childMemberIds) {
      const childResult = await sendNotificationToChildDevices({
        familyId: input.familyId,
        memberId,
        title: input.title,
        body: input.body,
        type: input.type
      });
      childDelivered += childResult.delivered;
      childDevicesTargeted += childResult.targetedDevices;
    }
  }

  return {
    adultDelivered,
    adultNotificationsCreated,
    childDelivered,
    childDevicesTargeted
  };
}

export async function clearPushToken(userId: string) {
  await db.update(users).set({ pushToken: null, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function clearChildDevicePushToken(deviceId: string) {
  await db.update(childDevices).set({ pushToken: null }).where(eq(childDevices.id, deviceId));
}

async function sendExpoPush(pushToken: string, title: string, body: string) {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: "default"
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}
