import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Lists the current user created.
export const myLists = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    return await ctx.db
      .query("lists")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
      .collect();
  },
});

// Gets a single list by id. Returns null if the id is malformed, doesn't
// exist, or isn't owned by the current user, so callers can render a
// "not found" state. `id` comes from a URL param, so it's untrusted input -
// take it as a string and normalize rather than v.id("lists"), which would
// throw ArgumentValidationError on anything the user can edit in the address bar.
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const id = ctx.db.normalizeId("lists", args.id);
    const list = id && (await ctx.db.get(id));
    if (!list || list.createdBy !== user._id) {
      return null;
    }
    // Owner display info for the list header. `createdBy` is a Better Auth user
    // id, which lives in the betterAuth component's tables, not ours.
    const owner = await authComponent.getAnyUserById(ctx, list.createdBy);
    return {
      ...list,
      owner: {
        name: owner?.name ?? "Unknown",
        image: owner?.image ?? null,
      },
    };
  },
});

export const create = mutation({
  args: { title: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    return await ctx.db.insert("lists", { ...args, itemCount: 0, createdBy: user._id });
  },
});
