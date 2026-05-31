import {
  notificationPrefsResponseSchema,
  notificationPrefsSchema,
  pushTokenSchema,
  userProfileSchema
} from "@homethread/shared";
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db } from "../db/client.js";
import { familyMembers, families, users } from "../db/schema.js";
import { getAuthStatus } from "../env.js";
import { deleteSupabaseUser, requireAuth } from "../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  const authRateLimit = {
    max: 5,
    timeWindow: "1 minute"
  } as const;

  app.get("/status", { config: { rateLimit: authRateLimit } }, async () => {
    return getAuthStatus();
  });

  app.post("/profile", { preHandler: requireAuth, config: { rateLimit: authRateLimit } }, async (request) => {
    const currentUser = request.currentUser!;
    const body = userProfileSchema.parse(request.body);

    const [profile] = await db
      .insert(users)
      .values({
        id: currentUser.id,
        email: currentUser.email,
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        phone: body.phone,
        timezone: body.timezone,
        locale: body.locale,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: body.displayName,
          avatarUrl: body.avatarUrl,
          phone: body.phone,
          timezone: body.timezone,
          locale: body.locale,
          updatedAt: new Date()
        }
      })
      .returning();

    return { user: profile };
  });

  app.get("/me", { preHandler: requireAuth, config: { rateLimit: authRateLimit } }, async (request) => {
    const currentUser = request.currentUser!;
    const profile = await db.query.users.findFirst({
      where: eq(users.id, currentUser.id)
    });

    const memberships = await db
      .select({
        member: familyMembers,
        family: families
      })
      .from(familyMembers)
      .innerJoin(families, eq(familyMembers.familyId, families.id))
      .where(eq(familyMembers.userId, currentUser.id));

    return {
      user: profile ?? {
        id: currentUser.id,
        email: currentUser.email
      },
      memberships
    };
  });

  app.delete("/account", { preHandler: requireAuth, config: { rateLimit: authRateLimit } }, async (request) => {
    const currentUser = request.currentUser!;
    await deleteSupabaseUser(currentUser.id);
    await db.delete(familyMembers).where(eq(familyMembers.userId, currentUser.id));
    await db.delete(users).where(eq(users.id, currentUser.id));
    return { deleted: true };
  });

  app.put("/push-token", { preHandler: requireAuth, config: { rateLimit: authRateLimit } }, async (request) => {
    const currentUser = request.currentUser!;
    const body = pushTokenSchema.parse(request.body);
    await ensureAuthUserProfile(currentUser.id, currentUser.email);

    const [profile] = await db
      .update(users)
      .set({
        pushToken: body.pushToken,
        updatedAt: new Date()
      })
      .where(eq(users.id, currentUser.id))
      .returning();

    return { user: profile };
  });

  app.put("/notification-prefs", { preHandler: requireAuth, config: { rateLimit: authRateLimit } }, async (request) => {
    const currentUser = request.currentUser!;
    const body = notificationPrefsSchema.parse(request.body);
    await ensureAuthUserProfile(currentUser.id, currentUser.email);

    const [profile] = await db
      .update(users)
      .set({
        notificationPrefs: body,
        updatedAt: new Date()
      })
      .where(eq(users.id, currentUser.id))
      .returning();

    return notificationPrefsResponseSchema.parse({
      user: {
        id: profile.id,
        notificationPrefs: profile.notificationPrefs,
        pushToken: profile.pushToken
      }
    });
  });
}

async function ensureAuthUserProfile(userId: string, email: string) {
  await db
    .insert(users)
    .values({
      id: userId,
      email,
      displayName: email.split("@")[0],
      updatedAt: new Date()
    })
    .onConflictDoNothing({
      target: users.id
    });
}
