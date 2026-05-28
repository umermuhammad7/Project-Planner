import {
  pushTokenSchema,
  userProfileSchema
} from "@homethread/shared";
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db } from "../db/client.js";
import { familyMembers, families, users } from "../db/schema.js";
import { deleteSupabaseUser, requireAuth } from "../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/profile", { preHandler: requireAuth }, async (request) => {
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

  app.get("/me", { preHandler: requireAuth }, async (request) => {
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

  app.delete("/account", { preHandler: requireAuth }, async (request) => {
    const currentUser = request.currentUser!;
    await db.delete(users).where(eq(users.id, currentUser.id));
    await deleteSupabaseUser(currentUser.id);
    return { deleted: true };
  });

  app.put("/push-token", { preHandler: requireAuth }, async (request) => {
    const currentUser = request.currentUser!;
    const body = pushTokenSchema.parse(request.body);

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
}
