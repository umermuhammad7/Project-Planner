import { eq, inArray } from "drizzle-orm";

import { db } from "../db/client.js";
import { familyMembers, notifications, users } from "../db/schema.js";

type SendFamilyNotificationInput = {
  familyId: string;
  title: string;
  body: string;
  type: string;
};

export async function sendNotificationToFamilyMembers(input: SendFamilyNotificationInput) {
  const members = await db.query.familyMembers.findMany({
    where: eq(familyMembers.familyId, input.familyId)
  });
  const userIds = members.map((member) => member.userId).filter((userId): userId is string => Boolean(userId));
  if (userIds.length === 0) {
    return { delivered: 0, createdNotifications: 0 };
  }

  const profiles = await db.query.users.findMany({
    where: inArray(users.id, userIds)
  });
  const familyProfiles = profiles.filter((profile) => profile.pushToken);

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

export async function clearPushToken(userId: string) {
  await db.update(users).set({ pushToken: null, updatedAt: new Date() }).where(eq(users.id, userId));
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
