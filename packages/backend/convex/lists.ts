import { ConvexError, v } from 'convex/values';
import { listSchema, type ListInput } from '../../shared/schemas/list';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { getClaimedItemCount } from './claims';
import { getAttendance } from './events';
import { getMembership } from './groups';
import { hasListAccess } from './listShares';
import { occasionValidator } from './schema';

// Resolves the event name/date when a list's occasion references one, so the
// client doesn't need a second round-trip.
export async function withOccasionEvent(ctx: QueryCtx, list: Doc<'lists'>) {
  let occasionEventName: string | null = null;
  let occasionEventDate: string | null = null;
  if (list.occasion?.kind === 'event') {
    const event = await ctx.db.get(list.occasion.eventId);
    occasionEventName = event?.name ?? null;
    occasionEventDate = event?.date ?? null;
  }
  return { ...list, occasionEventName, occasionEventDate };
}

// Lists the current user created, excluding archived ones.
export const myLists = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.getAuthUser(ctx);
    const lists = await ctx.db
      .query('lists')
      .withIndex('by_createdBy_archivedAt', q => q.eq('createdBy', user._id).eq('archivedAt', undefined))
      .collect();
    return await Promise.all(lists.map(list => withOccasionEvent(ctx, list)));
  },
});

// The current user's archived lists, most recently archived first.
export const myArchivedLists = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.getAuthUser(ctx);
    const lists = await ctx.db
      .query('lists')
      .withIndex('by_createdBy_archivedAt', q => q.eq('createdBy', user._id).gt('archivedAt', 0))
      .order('desc')
      .collect();
    return await Promise.all(lists.map(list => withOccasionEvent(ctx, list)));
  },
});

// Lists whose occasion is this event. Every attendee can open these (see
// hasListAccess), so no per-list check is needed. Others' lists come first;
// the viewer's own come last. `claimedItemCount` is null on the viewer's own
// lists, since owners never see claims.
export const forEvent = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!(await getAttendance(ctx, args.eventId, user._id))) return null;

    const others = [];
    const mine = [];
    for await (const list of ctx.db
      .query('lists')
      .withIndex('by_occasion_event', q => q.eq('occasion.eventId', args.eventId))) {
      if (list.archivedAt !== undefined) continue;
      if (list.createdBy === user._id) {
        mine.push({
          _id: list._id,
          title: list.title,
          itemCount: list.itemCount,
          claimedItemCount: null,
          ownerId: list.createdBy,
          ownerName: user.name,
        });
        continue;
      }
      const owner = await authComponent.getAnyUserById(ctx, list.createdBy);
      others.push({
        _id: list._id,
        title: list.title,
        itemCount: list.itemCount,
        claimedItemCount: await getClaimedItemCount(ctx, list._id),
        ownerId: list.createdBy,
        ownerName: owner?.name ?? 'Unknown',
      });
    }
    return [...others, ...mine];
  },
});

// Gets a single list by id. Returns null if the id is malformed, doesn't
// exist, or isn't visible to the current user (its owner, or shared with
// them directly or through a group/event they belong to), so callers can
// render a "not found" state. `id` comes from a URL param, so it's untrusted
// input - take it as a string and normalize rather than v.id("lists"), which
// would throw ArgumentValidationError on anything the user can edit in the
// address bar.
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const id = ctx.db.normalizeId('lists', args.id);
    const list = id && (await ctx.db.get(id));
    if (!list || !(await hasListAccess(ctx, list, user._id))) {
      return null;
    }
    // Owner display info for the list header. `createdBy` is a Better Auth user
    // id, which lives in the betterAuth component's tables, not ours.
    const owner = await authComponent.getAnyUserById(ctx, list.createdBy);

    return {
      ...(await withOccasionEvent(ctx, list)),
      isMine: list.createdBy === user._id,
      owner: {
        userId: list.createdBy,
        name: owner?.name ?? 'Unknown',
        image: owner?.image ?? null,
      },
    };
  },
});

// Runs the same checks the web and mobile forms run, so a client that skips
// them can't save an empty or overlong title or a bad date. Returns the cleaned
// (trimmed) fields.
function validateList(fields: ListInput) {
  const result = listSchema.safeParse(fields);
  if (!result.success) {
    throw new ConvexError(result.error.issues[0]?.message ?? 'Invalid list');
  }
  return result.data;
}

// An event occasion must be one the user is attending.
async function checkOccasion(ctx: MutationCtx, occasion: ListInput['occasion'], userId: string) {
  if (occasion?.kind === 'event' && !(await getAttendance(ctx, occasion.eventId, userId))) {
    throw new ConvexError("You can only pick events you're attending.");
  }
}

// Makes the list's group shares match `groupIds` exactly: adds missing ones,
// removes unchecked ones. User and event shares are left alone.
async function syncGroupShares(ctx: MutationCtx, listId: Id<'lists'>, groupIds: Id<'groups'>[], userId: string) {
  const wanted = new Set(groupIds);
  for (const groupId of wanted) {
    if (!(await getMembership(ctx, groupId, userId))) {
      throw new ConvexError("You can only share with groups you're a member of.");
    }
  }

  const existing = new Set<Id<'groups'>>();
  for await (const share of ctx.db.query('listShares').withIndex('by_list', q => q.eq('listId', listId))) {
    if (!share.sharedWithGroupId) continue;
    if (wanted.has(share.sharedWithGroupId)) existing.add(share.sharedWithGroupId);
    else await ctx.db.delete(share._id);
  }

  for (const groupId of wanted) {
    if (!existing.has(groupId)) {
      await ctx.db.insert('listShares', { listId, sharedWithGroupId: groupId, canEdit: false });
    }
  }
}

const listFields = {
  title: v.string(),
  notes: v.optional(v.string()),
  occasion: v.optional(occasionValidator),
  // Omit to leave the list's group shares unchanged.
  sharedWithGroupIds: v.optional(v.array(v.id('groups'))),
};

export const create = mutation({
  args: listFields,
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const { sharedWithGroupIds, notes, ...input } = args;
    const { title, occasion } = validateList(input);
    await checkOccasion(ctx, occasion, user._id);

    const id = await ctx.db.insert('lists', { title, notes, occasion, itemCount: 0, createdBy: user._id });
    if (sharedWithGroupIds) await syncGroupShares(ctx, id, sharedWithGroupIds, user._id);
    return id;
  },
});

// Note: leaving `occasion` out clears it, same as `notes`.
export const update = mutation({
  args: { id: v.id('lists'), ...listFields },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.id);
    if (!list || list.createdBy !== user._id) {
      throw new Error('List not found');
    }

    const { id, sharedWithGroupIds, notes, ...input } = args;
    const { title, occasion } = validateList(input);
    await checkOccasion(ctx, occasion, user._id);

    await ctx.db.patch(id, { title, notes, occasion });
    if (sharedWithGroupIds) await syncGroupShares(ctx, id, sharedWithGroupIds, user._id);
  },
});

// Archiving is the normal way to remove a list: it hides the list from the
// owner's main lists and from everyone it's shared with, but keeps its items,
// shares, and favorites so `unarchive` restores it exactly as it was.
export const archive = mutation({
  args: { id: v.id('lists') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.id);
    if (!list || list.createdBy !== user._id) {
      throw new Error('List not found');
    }
    if (list.archivedAt !== undefined) return;

    await ctx.db.patch(args.id, { archivedAt: Date.now() });
  },
});

export const unarchive = mutation({
  args: { id: v.id('lists') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.id);
    if (!list || list.createdBy !== user._id) {
      throw new Error('List not found');
    }

    await ctx.db.patch(args.id, { archivedAt: undefined });
  },
});

// Deletes a list along with everything that hangs off it - its items and any
// shares and claims - so nothing orphaned is left behind.
export const remove = mutation({
  args: { id: v.id('lists') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.id);
    if (!list || list.createdBy !== user._id) {
      throw new Error('List not found');
    }

    for await (const item of ctx.db.query('items').withIndex('by_listId', q => q.eq('listId', list._id))) {
      await ctx.db.delete(item._id);
    }
    for await (const share of ctx.db.query('listShares').withIndex('by_list', q => q.eq('listId', list._id))) {
      await ctx.db.delete(share._id);
    }
    for await (const claim of ctx.db.query('claims').withIndex('by_list', q => q.eq('listId', list._id))) {
      await ctx.db.delete(claim._id);
    }
    for await (const stats of ctx.db.query('listClaimStats').withIndex('by_list', q => q.eq('listId', list._id))) {
      await ctx.db.delete(stats._id);
    }
    for await (const favorite of ctx.db
      .query('favorites')
      .withIndex('by_favoritedListId', q => q.eq('favoritedListId', list._id))) {
      await ctx.db.delete(favorite._id);
    }

    await ctx.db.delete(list._id);
  },
});
