import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { priorityValidator } from "./schema";
import { hasListAccess } from "./listShares";

// Items in a list, oldest first. `listId` comes from a URL param, so it's
// untrusted - normalize it rather than v.id("lists") (which would throw on
// anything the user edits in the address bar) and return [] when the list is
// missing or not visible to the current user, matching lists.get.
export const list = query({
  args: { listId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const listId = ctx.db.normalizeId("lists", args.listId);
    const list = listId && (await ctx.db.get(listId));
    if (!list || !(await hasListAccess(ctx, list, user._id))) {
      return [];
    }
    return await ctx.db
      .query("items")
      .withIndex("by_listId", (q) => q.eq("listId", list._id))
      .collect();
  },
});

export const create = mutation({
  args: {
    listId: v.id("lists"),
    name: v.string(),
    link: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.listId);
    if (!list || list.createdBy !== user._id) {
      throw new Error("List not found");
    }

    const itemId = await ctx.db.insert("items", { ...args, createdBy: user._id });
    await ctx.db.patch(list._id, { itemCount: list.itemCount + 1 });
    return itemId;
  },
});

export const update = mutation({
  args: {
    id: v.id("items"),
    name: v.string(),
    link: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    const list = await ctx.db.get(item.listId);
    if (!list || list.createdBy !== user._id) {
      throw new Error("Item not found");
    }

    const { id, ...fields } = args;
    // Optional fields left off by the client come through as `undefined`, and
    // patching a field to `undefined` clears it - so this both updates and
    // unsets (e.g. a link the user deleted).
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    const list = await ctx.db.get(item.listId);
    if (!list || list.createdBy !== user._id) {
      throw new Error("Item not found");
    }

    await ctx.db.delete(args.id);
    await ctx.db.patch(list._id, { itemCount: Math.max(0, list.itemCount - 1) });
  },
});
