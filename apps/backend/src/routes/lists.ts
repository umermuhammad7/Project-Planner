import {
  createListItemSchema,
  createListSchema,
  updateListItemSchema,
  updateListSchema,
  uuidSchema
} from "@homethread/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../db/client.js";
import { familyMembers, listItems, lists } from "../db/schema.js";
import { sendError } from "../lib/http.js";
import { requireAuth } from "../plugins/auth.js";
import { requireFamilyMember } from "../plugins/familyAccess.js";

const familyParamsSchema = z.object({
  familyId: uuidSchema
});

const listParamsSchema = familyParamsSchema.extend({
  listId: uuidSchema
});

const itemParamsSchema = listParamsSchema.extend({
  itemId: uuidSchema
});

export async function listsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const familyLists = await db.query.lists.findMany({
      where: eq(lists.familyId, familyId),
      orderBy: asc(lists.createdAt)
    });

    if (familyLists.length === 0) {
      return { lists: [] };
    }

    const items = await db.query.listItems.findMany({
      where: inArray(
        listItems.listId,
        familyLists.map((list) => list.id)
      ),
      orderBy: asc(listItems.sortOrder)
    });

    const itemsByListId = items.reduce<Record<string, typeof items>>((grouped, item) => {
      grouped[item.listId] = [...(grouped[item.listId] ?? []), item];
      return grouped;
    }, {});

    return {
      lists: familyLists.map((list) => ({
        ...list,
        items: itemsByListId[list.id] ?? []
      }))
    };
  });

  app.post("/", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId } = familyParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = createListSchema.parse(request.body);
    const [list] = await db
      .insert(lists)
      .values({
        familyId,
        title: body.title,
        type: body.type,
        color: body.color,
        icon: body.icon,
        isShared: body.isShared,
        createdBy: currentUser.id
      })
      .returning();

    return reply.status(201).send({ list });
  });

  app.patch("/:listId", async (request, reply) => {
    const { familyId, listId } = listParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const body = updateListSchema.parse(request.body);
    const [list] = await db
      .update(lists)
      .set({
        title: body.title,
        type: body.type,
        color: body.color,
        icon: body.icon,
        isShared: body.isShared
      })
      .where(and(eq(lists.familyId, familyId), eq(lists.id, listId)))
      .returning();

    if (!list) {
      return sendError(reply, 404, "List not found", "LIST_NOT_FOUND");
    }

    return { list };
  });

  app.delete("/:listId", async (request, reply) => {
    const { familyId, listId } = listParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const deleted = await db
      .delete(lists)
      .where(and(eq(lists.familyId, familyId), eq(lists.id, listId)))
      .returning({ id: lists.id });

    if (deleted.length === 0) {
      return sendError(reply, 404, "List not found", "LIST_NOT_FOUND");
    }

    return { deleted: true };
  });

  app.post("/:listId/items", async (request, reply) => {
    const currentUser = request.currentUser!;
    const { familyId, listId } = listParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const list = await db.query.lists.findFirst({
      where: and(eq(lists.familyId, familyId), eq(lists.id, listId))
    });

    if (!list) {
      return sendError(reply, 404, "List not found", "LIST_NOT_FOUND");
    }

    const body = createListItemSchema.parse(request.body);
    const [item] = await db
      .insert(listItems)
      .values({
        listId,
        content: body.content,
        category: body.category,
        quantity: body.quantity,
        sortOrder: body.sortOrder ?? 0,
        createdBy: currentUser.id
      })
      .returning();

    return reply.status(201).send({ item });
  });

  app.patch("/:listId/items/:itemId", async (request, reply) => {
    const { familyId, listId, itemId } = itemParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const list = await db.query.lists.findFirst({
      where: and(eq(lists.familyId, familyId), eq(lists.id, listId))
    });

    if (!list) {
      return sendError(reply, 404, "List not found", "LIST_NOT_FOUND");
    }

    const body = updateListItemSchema.parse(request.body);
    const actorMemberId =
      body.isChecked === undefined ? undefined : await getActorMemberId(familyId, request.currentUser!.id);

    const [item] = await db
      .update(listItems)
      .set({
        content: body.content,
        category: body.category,
        quantity: body.quantity,
        isChecked: body.isChecked,
        checkedAt: body.isChecked === undefined ? undefined : body.isChecked ? new Date() : null,
        checkedBy: body.isChecked === undefined ? undefined : body.isChecked ? actorMemberId ?? null : null,
        sortOrder: body.sortOrder
      })
      .where(and(eq(listItems.listId, listId), eq(listItems.id, itemId)))
      .returning();

    if (!item) {
      return sendError(reply, 404, "List item not found", "LIST_ITEM_NOT_FOUND");
    }

    return { item };
  });

  app.post("/:listId/clear-checked", async (request, reply) => {
    const { familyId, listId } = listParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const list = await db.query.lists.findFirst({
      where: and(eq(lists.familyId, familyId), eq(lists.id, listId))
    });

    if (!list) {
      return sendError(reply, 404, "List not found", "LIST_NOT_FOUND");
    }

    const deleted = await db
      .delete(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.isChecked, true)))
      .returning({ id: listItems.id });

    return { deletedCount: deleted.length };
  });

  app.delete("/:listId/items/:itemId", async (request, reply) => {
    const { familyId, listId, itemId } = itemParamsSchema.parse(request.params);
    const membership = await requireFamilyMember(request, reply, familyId);
    if (!membership) return;

    const list = await db.query.lists.findFirst({
      where: and(eq(lists.familyId, familyId), eq(lists.id, listId))
    });

    if (!list) {
      return sendError(reply, 404, "List not found", "LIST_NOT_FOUND");
    }

    const deleted = await db
      .delete(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.id, itemId)))
      .returning({ id: listItems.id });

    if (deleted.length === 0) {
      return sendError(reply, 404, "List item not found", "LIST_ITEM_NOT_FOUND");
    }

    return { deleted: true };
  });
}

async function getActorMemberId(familyId: string, userId: string) {
  const member = await db.query.familyMembers.findFirst({
    where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId))
  });

  return member?.id ?? null;
}
