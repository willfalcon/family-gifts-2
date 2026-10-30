import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { priorityValidator } from './schema';
import { hasListAccess } from './listShares';
import { claimSnapshot, syncItemClaimed } from './claims';

export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    await authComponent.getAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Items in a list, oldest first. `listId` comes from a URL param, so it's
// untrusted - normalize it rather than v.id("lists") (which would throw on
// anything the user edits in the address bar) and return [] when the list is
// missing or not visible to the current user, matching lists.get.
export const list = query({
  args: { listId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const listId = ctx.db.normalizeId('lists', args.listId);
    const list = listId && (await ctx.db.get(listId));
    if (!list || !(await hasListAccess(ctx, list, user._id))) {
      return [];
    }
    const items = await ctx.db
      .query('items')
      .withIndex('by_listId', q => q.eq('listId', list._id))
      .collect();

    return await Promise.all(
      items.map(async item => ({
        ...item,
        imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
      })),
    );
  },
});

export const create = mutation({
  args: {
    listId: v.id('lists'),
    name: v.string(),
    link: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    price: v.optional(v.number()),
    quantity: v.optional(v.number()),
    imageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.listId);
    if (!list || list.createdBy !== user._id) {
      throw new Error('List not found');
    }

    const itemId = await ctx.db.insert('items', { ...args, createdBy: user._id });
    await ctx.db.patch(list._id, { itemCount: list.itemCount + 1 });
    return itemId;
  },
});

export const update = mutation({
  args: {
    id: v.id('items'),
    listId: v.optional(v.id('lists')),
    name: v.string(),
    link: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    price: v.optional(v.number()),
    quantity: v.optional(v.number()),
    imageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error('Item not found');
    }

    const oldList = await ctx.db.get(item.listId);
    if (!oldList || oldList.createdBy !== user._id) {
      throw new Error('Item not found');
    }

    const { id, listId: newListId, ...fields } = args;
    // A new quantity or list can change whether the item counts as fully claimed.
    const claimsBefore = await claimSnapshot(ctx, item);

    if (newListId && newListId !== item.listId) {
      const newList = await ctx.db.get(newListId);
      if (!newList || newList.createdBy !== user._id) {
        throw new Error('List not found');
      }
      await ctx.db.patch(oldList._id, { itemCount: Math.max(0, oldList.itemCount - 1) });
      await ctx.db.patch(newListId, { itemCount: newList.itemCount + 1 });
      for await (const claim of ctx.db.query('claims').withIndex('by_item', q => q.eq('itemId', id))) {
        await ctx.db.patch(claim._id, { listId: newListId });
      }
    }

    // Optional fields left off by the client come through as `undefined`, and
    // patching a field to `undefined` clears it - so this both updates and
    // unsets (e.g. a link the user deleted).
    await ctx.db.patch(id, { ...fields, ...(newListId ? { listId: newListId } : {}) });
    await syncItemClaimed(ctx, claimsBefore, await ctx.db.get(id));
  },
});

export const updatePriority = mutation({
  args: {
    id: v.id('items'),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error('Item not found');
    }

    const list = await ctx.db.get(item.listId);
    if (!list || list.createdBy !== user._id) {
      throw new Error('Item not found');
    }

    await ctx.db.patch(args.id, { priority: args.priority });
  },
});

export const remove = mutation({
  args: { id: v.id('items') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error('Item not found');
    }

    const list = await ctx.db.get(item.listId);
    if (!list || list.createdBy !== user._id) {
      throw new Error('Item not found');
    }

    const claimsBefore = await claimSnapshot(ctx, item);
    for await (const claim of ctx.db.query('claims').withIndex('by_item', q => q.eq('itemId', args.id))) {
      await ctx.db.delete(claim._id);
    }
    await ctx.db.delete(args.id);
    await ctx.db.patch(list._id, { itemCount: Math.max(0, list.itemCount - 1) });
    await syncItemClaimed(ctx, claimsBefore, null);
  },
});
