import {
  completionScopeSchema,
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
  uuidSchema
} from "@homethread/shared";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { eventMembers, events } from "../db/schema.js";
import { getTravelReminderRecommendation } from "../lib/travelReminder.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

const eventParamsSchema = familyParamsSchema.extend({
  eventId: uuidSchema
});

const scopeQuerySchema = z.object({
  scope: completionScopeSchema
});

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const query = listEventsQuerySchema.parse(request.query);
    const filters = [eq(events.familyId, familyId)];
    if (query.from) filters.push(gte(events.startAt, new Date(query.from)));
    if (query.to) filters.push(lte(events.startAt, new Date(query.to)));

    const rows = await db.query.events.findMany({
      where: and(...filters),
      orderBy: asc(events.startAt)
    });

    if (rows.length === 0) {
      return { events: [] };
    }

    const memberships = await db.query.eventMembers.findMany({
      where: inArray(
        eventMembers.eventId,
        rows.map((event) => event.id)
      )
    });

    const memberIdsByEventId = memberships.reduce<Record<string, string[]>>((grouped, membership) => {
      grouped[membership.eventId] = [...(grouped[membership.eventId] ?? []), membership.memberId];
      return grouped;
    }, {});

    const hydrated = rows.map((event) => ({
      ...event,
      memberIds: memberIdsByEventId[event.id] ?? []
    }));

    if (!query.memberId) {
      return { events: hydrated };
    }

    return { events: hydrated.filter((event) => event.memberIds.includes(query.memberId!)) };
  });

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = createEventSchema.parse(request.body);
    const result = await db.transaction(async (tx) => {
      const [event] = await tx
        .insert(events)
        .values({
          familyId,
          title: body.title,
          description: body.description,
          location: body.location,
          locationLat: body.locationLat?.toString(),
          locationLng: body.locationLng?.toString(),
          startAt: new Date(body.startAt),
          endAt: new Date(body.endAt),
          allDay: body.allDay,
          color: body.color,
          recurrenceRule: body.recurrenceRule,
          recurrenceEndAt: body.recurrenceEndAt ? new Date(body.recurrenceEndAt) : null,
          createdBy: currentUser.id
        })
        .returning();

      if (body.memberIds.length > 0) {
        await tx.insert(eventMembers).values(
          body.memberIds.map((memberId) => ({
            eventId: event.id,
            memberId
          }))
        );
      }

      return event;
    });

    return reply.status(201).send({ event: result });
  });

  app.get("/upcoming", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const rows = await db.query.events.findMany({
      where: and(eq(events.familyId, familyId), gte(events.startAt, new Date())),
      orderBy: asc(events.startAt),
      limit: 10
    });

    return { events: rows };
  });

  app.get("/countdowns", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const rows = await db.query.events.findMany({
      where: and(eq(events.familyId, familyId), sql`${events.countdownLabel} is not null`),
      orderBy: asc(events.startAt)
    });

    return { events: rows };
  });

  app.get("/:eventId", async (request, reply) => {
    const { familyId, eventId } = eventParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const event = await db.query.events.findFirst({
      where: and(eq(events.familyId, familyId), eq(events.id, eventId))
    });

    return { event };
  });

  app.get("/:eventId/travel-reminder", async (request, reply) => {
    const { familyId, eventId } = eventParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const event = await db.query.events.findFirst({
      where: and(eq(events.familyId, familyId), eq(events.id, eventId))
    });

    if (!event) {
      reply.status(404);
      return {
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      };
    }

    return getTravelReminderRecommendation({
      locationLat: event.locationLat ? Number(event.locationLat) : null,
      locationLng: event.locationLng ? Number(event.locationLng) : null,
      startAt: event.startAt
    });
  });

  app.patch("/:eventId", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId, eventId } = eventParamsSchema.parse(request.params);
    scopeQuerySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const existingEvent = await db.query.events.findFirst({
      where: and(eq(events.familyId, familyId), eq(events.id, eventId))
    });

    if (!existingEvent) {
      return reply.status(404).send({
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
    }

    if (!canManageEvent(membership.role, currentUser.id, existingEvent.createdBy)) {
      return reply.status(403).send({
        error: "Only the event creator or a family admin can edit this event",
        code: "EVENT_FORBIDDEN"
      });
    }

    const body = updateEventSchema.parse(request.body);
    const [event] = await db
      .update(events)
      .set({
        title: body.title,
        description: body.description,
        location: body.location,
        locationLat: body.locationLat?.toString(),
        locationLng: body.locationLng?.toString(),
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
        allDay: body.allDay,
        color: body.color,
        recurrenceRule: body.recurrenceRule,
        recurrenceEndAt: body.recurrenceEndAt ? new Date(body.recurrenceEndAt) : undefined,
        updatedAt: new Date()
      })
      .where(and(eq(events.familyId, familyId), eq(events.id, eventId)))
      .returning();

    if (body.memberIds) {
      await db.delete(eventMembers).where(eq(eventMembers.eventId, eventId));
      if (body.memberIds.length > 0) {
        await db.insert(eventMembers).values(
          body.memberIds.map((memberId) => ({
            eventId,
            memberId
          }))
        );
      }
    }

    return { event };
  });

  app.delete("/:eventId", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId, eventId } = eventParamsSchema.parse(request.params);
    scopeQuerySchema.parse(request.query);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const existingEvent = await db.query.events.findFirst({
      where: and(eq(events.familyId, familyId), eq(events.id, eventId))
    });

    if (!existingEvent) {
      return reply.status(404).send({
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
    }

    if (!canManageEvent(membership.role, currentUser.id, existingEvent.createdBy)) {
      return reply.status(403).send({
        error: "Only the event creator or a family admin can delete this event",
        code: "EVENT_FORBIDDEN"
      });
    }

    await db.delete(events).where(and(eq(events.familyId, familyId), eq(events.id, eventId)));
    return { deleted: true };
  });
}

function canManageEvent(memberRole: string, currentUserId: string, createdBy: string) {
  return memberRole === "admin" || currentUserId === createdBy;
}
