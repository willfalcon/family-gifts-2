import { ConvexError, v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { hasListAccess } from './listShares';

// How many of an item the owner wants. Unset means one.
export function wantedQuantity(item: Doc<'items'>) {
  return Math.max(1, item.quantity ?? 1);
}

async function claimedQuantity(ctx: QueryCtx, itemId: Id<'items'>) {
  let total = 0;
  for await (const claim of ctx.db.query('claims').withIndex('by_item', q => q.eq('itemId', itemId))) {
    total += claim.quantity;
  }
  return total;
}

async function isFullyClaimed(ctx: QueryCtx, item: Doc<'items'>) {
  return (await claimedQuantity(ctx, item._id)) >= wantedQuantity(item);
}

export async function getClaimedItemCount(ctx: QueryCtx, listId: Id<'lists'>) {
  const stats = await ctx.db
    .query('listClaimStats')
    .withIndex('by_list', q => q.eq('listId', listId))
    .unique();
  return stats?.claimedItemCount ?? 0;
}

async function adjustClaimedItemCount(ctx: MutationCtx, listId: Id<'lists'>, delta: number) {
  const stats = await ctx.db
    .query('listClaimStats')
    .withIndex('by_list', q => q.eq('listId', listId))
    .unique();
  if (stats) {
    await ctx.db.patch(stats._id, { claimedItemCount: Math.max(0, stats.claimedItemCount + delta) });
  } else if (delta > 0) {
    await ctx.db.insert('listClaimStats', { listId, claimedItemCount: delta });
  }
}

// Keeps `listClaimStats` in step with any change that can flip an item between
// "fully claimed" and not: a claim, an unclaim, a quantity edit, a move to
// another list, or deleting the item. Take a snapshot before the change, make
// the change, then pass the snapshot and the item as it is now (null if deleted).
export async function claimSnapshot(ctx: QueryCtx, item: Doc<'items'>) {
  return { listId: item.listId, full: await isFullyClaimed(ctx, item) };
}

export async function syncItemClaimed(
  ctx: MutationCtx,
  before: { listId: Id<'lists'>; full: boolean },
  after: Doc<'items'> | null,
) {
  const afterFull = after ? await isFullyClaimed(ctx, after) : false;
  if (after && before.listId === after.listId && before.full === afterFull) return;
  if (before.full) await adjustClaimedItemCount(ctx, before.listId, -1);
  if (after && afterFull) await adjustClaimedItemCount(ctx, after.listId, 1);
}

// Loads an item the caller may claim: they can see its list and don't own it.
async function getClaimableItem(ctx: QueryCtx, itemId: Id<'items'>, userId: string) {
  const item = await ctx.db.get(itemId);
  const list = item && (await ctx.db.get(item.listId));
  if (!item || !list || !(await hasListAccess(ctx, list, userId))) {
    throw new Error('Item not found');
  }
  if (list.createdBy === userId) {
    throw new ConvexError("You can't claim your own ideas.");
  }
  return item;
}

// Claims `quantity` of an item for the caller, replacing any earlier claim of
// theirs on it - so this is also how someone changes how many they're getting.
export const claim = mutation({
  args: { itemId: v.id('items'), quantity: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await getClaimableItem(ctx, args.itemId, user._id);

    const quantity = args.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ConvexError('Quantity must be a whole number of at least 1.');
    }

    const mine = await ctx.db
      .query('claims')
      .withIndex('by_item_user', q => q.eq('itemId', item._id).eq('userId', user._id))
      .unique();
    const othersClaimed = (await claimedQuantity(ctx, item._id)) - (mine?.quantity ?? 0);
    const left = wantedQuantity(item) - othersClaimed;
    if (quantity > left) {
      throw new ConvexError(left > 0 ? `Only ${left} left to claim.` : 'Someone already claimed this.');
    }

    const before = await claimSnapshot(ctx, item);
    if (mine) {
      await ctx.db.patch(mine._id, { quantity });
    } else {
      await ctx.db.insert('claims', { itemId: item._id, listId: item.listId, userId: user._id, quantity });
    }
    await syncItemClaimed(ctx, before, item);
  },
});

export const unclaim = mutation({
  args: { itemId: v.id('items') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const item = await getClaimableItem(ctx, args.itemId, user._id);

    const mine = await ctx.db
      .query('claims')
      .withIndex('by_item_user', q => q.eq('itemId', item._id).eq('userId', user._id))
      .unique();
    if (!mine) return;

    const before = await claimSnapshot(ctx, item);
    await ctx.db.delete(mine._id);
    await syncItemClaimed(ctx, before, item);
  },
});

// Claim status for every item on a list, for someone shopping from it.
// Returns null for the list's owner - they never see claims - and for anyone
// who can't see the list. `listId` comes from a URL param, so it's normalized.
export const forList = query({
  args: { listId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const listId = ctx.db.normalizeId('lists', args.listId);
    const list = listId && (await ctx.db.get(listId));
    if (!list || list.createdBy === user._id || !(await hasListAccess(ctx, list, user._id))) {
      return null;
    }

    // `otherClaimers` is the names of everyone else claiming the item, so a
    // shopper can see who's already getting it.
    const byItem: Record<string, { claimedQuantity: number; myQuantity: number; otherClaimers: string[] }> = {};
    const names = new Map<string, string>();
    for await (const claim of ctx.db.query('claims').withIndex('by_list', q => q.eq('listId', list._id))) {
      const entry = (byItem[claim.itemId] ??= { claimedQuantity: 0, myQuantity: 0, otherClaimers: [] });
      entry.claimedQuantity += claim.quantity;
      if (claim.userId === user._id) {
        entry.myQuantity += claim.quantity;
      } else {
        let name = names.get(claim.userId);
        if (name === undefined) {
          name = (await authComponent.getAnyUserById(ctx, claim.userId))?.name ?? 'Someone';
          names.set(claim.userId, name);
        }
        entry.otherClaimers.push(name);
      }
    }
    return byItem;
  },
});
