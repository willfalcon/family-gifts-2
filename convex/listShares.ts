import { v, ConvexError } from 'convex/values';
import { mutation, query, type QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getMembership } from './groups';
import { getAttendance } from './events';

// Whether `userId` can view `list` - its owner, or anyone reachable through
// one of its shares (a direct share, or membership/attendance in a shared
// group/event). Shared access is always read-only; only the owner can edit.
export async function hasListAccess(ctx: QueryCtx, list: Doc<'lists'>, userId: string): Promise<boolean> {
  if (list.createdBy === userId) return true;

  for await (const share of ctx.db.query('listShares').withIndex('by_list', q => q.eq('listId', list._id))) {
    if (share.sharedWithUserId === userId) return true;
    if (share.sharedWithGroupId && (await getMembership(ctx, share.sharedWithGroupId, userId))) return true;
    if (share.sharedWithEventId && (await getAttendance(ctx, share.sharedWithEventId, userId))) return true;
  }

  return false;
}

async function requireListOwner(ctx: QueryCtx, listId: Id<'lists'>, userId: string) {
  const list = await ctx.db.get(listId);
  if (!list || list.createdBy !== userId) {
    throw new Error('List not found');
  }
  return list;
}

// A list's shares, with display info resolved for whichever target each row
// points at. Owner-only, since the sharing roster (and any individually
// shared-with people) is management info for the list's owner alone.
export const list = query({
  args: { listId: v.id('lists') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireListOwner(ctx, args.listId, user._id);

    const shares = await ctx.db
      .query('listShares')
      .withIndex('by_list', q => q.eq('listId', args.listId))
      .collect();

    return await Promise.all(
      shares.map(async share => {
        if (share.sharedWithGroupId) {
          const group = await ctx.db.get(share.sharedWithGroupId);
          return { id: share._id, kind: 'group' as const, name: group?.name ?? 'Unknown group' };
        }
        if (share.sharedWithEventId) {
          const event = await ctx.db.get(share.sharedWithEventId);
          return { id: share._id, kind: 'event' as const, name: event?.name ?? 'Unknown event' };
        }
        const sharedUser = share.sharedWithUserId ? await authComponent.getAnyUserById(ctx, share.sharedWithUserId) : null;
        return { id: share._id, kind: 'user' as const, name: sharedUser?.name ?? 'Unknown', image: sharedUser?.image ?? null };
      })
    );
  },
});

// People the current user can individually share a list with: everyone they
// share a group or event with, deduplicated. There's no global user
// directory in this app, so individual sharing is scoped to people the
// current user already has some connection to, rather than an open search.
export const myConnections = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);

    const memberships = await ctx.db.query('groupMembers').withIndex('by_user', q => q.eq('userId', user._id)).collect();
    const attendances = await ctx.db.query('eventAttendees').withIndex('by_user', q => q.eq('userId', user._id)).collect();

    const connectionIds = new Set<string>();
    for (const membership of memberships) {
      const members = await ctx.db.query('groupMembers').withIndex('by_group', q => q.eq('groupId', membership.groupId)).collect();
      for (const member of members) connectionIds.add(member.userId);
    }
    for (const attendance of attendances) {
      const attendees = await ctx.db.query('eventAttendees').withIndex('by_event', q => q.eq('eventId', attendance.eventId)).collect();
      for (const attendee of attendees) connectionIds.add(attendee.userId);
    }
    connectionIds.delete(user._id);

    const connections = await Promise.all(
      Array.from(connectionIds).map(async userId => {
        const connectionUser = await authComponent.getAnyUserById(ctx, userId);
        return connectionUser && { userId, name: connectionUser.name, image: connectionUser.image ?? null };
      })
    );
    return connections.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

// Shares a list with every current (and future) member of a group the caller
// belongs to - a live link, not a snapshot, so members who join later see the
// list automatically and removing a member drops their access without any
// listShares cleanup.
export const shareWithGroup = mutation({
  args: { listId: v.id('lists'), groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireListOwner(ctx, args.listId, user._id);

    if (!(await getMembership(ctx, args.groupId, user._id))) {
      throw new ConvexError("You can only share with groups you're a member of.");
    }

    const existing = await ctx.db
      .query('listShares')
      .withIndex('by_list', q => q.eq('listId', args.listId))
      .filter(q => q.eq(q.field('sharedWithGroupId'), args.groupId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert('listShares', { listId: args.listId, sharedWithGroupId: args.groupId, canEdit: false });
  },
});

// Shares a list with every current (and future) attendee of an event the
// caller is part of - mirrors shareWithGroup above.
export const shareWithEvent = mutation({
  args: { listId: v.id('lists'), eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireListOwner(ctx, args.listId, user._id);

    if (!(await getAttendance(ctx, args.eventId, user._id))) {
      throw new ConvexError("You can only share with events you're attending.");
    }

    const existing = await ctx.db
      .query('listShares')
      .withIndex('by_list', q => q.eq('listId', args.listId))
      .filter(q => q.eq(q.field('sharedWithEventId'), args.eventId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert('listShares', { listId: args.listId, sharedWithEventId: args.eventId, canEdit: false });
  },
});

// Shares a list with one specific person. Restricted to the caller's
// connections (see myConnections) so a client can't share with an arbitrary
// account it merely knows the id of.
export const shareWithUser = mutation({
  args: { listId: v.id('lists'), userId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireListOwner(ctx, args.listId, user._id);

    if (args.userId === user._id) {
      throw new ConvexError("You can't share a list with yourself.");
    }

    let connected = false;
    for await (const membership of ctx.db.query('groupMembers').withIndex('by_user', q => q.eq('userId', user._id))) {
      if (await getMembership(ctx, membership.groupId, args.userId)) {
        connected = true;
        break;
      }
    }
    if (!connected) {
      for await (const attendance of ctx.db.query('eventAttendees').withIndex('by_user', q => q.eq('userId', user._id))) {
        if (await getAttendance(ctx, attendance.eventId, args.userId)) {
          connected = true;
          break;
        }
      }
    }
    if (!connected) {
      throw new ConvexError("You can only share with someone you're connected to through a group or event.");
    }

    const existing = await ctx.db
      .query('listShares')
      .withIndex('by_list', q => q.eq('listId', args.listId))
      .filter(q => q.eq(q.field('sharedWithUserId'), args.userId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert('listShares', { listId: args.listId, sharedWithUserId: args.userId, canEdit: false });
  },
});

// Undoes any of the three share kinds above - the owner drops the whole
// group's/event's/person's access in one action, rather than having to
// unshare from each member individually.
export const unshare = mutation({
  args: { id: v.id('listShares') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const share = await ctx.db.get(args.id);
    if (!share) throw new Error('Share not found');
    await requireListOwner(ctx, share.listId, user._id);

    await ctx.db.delete(args.id);
  },
});

// Lists shared with a group - including the caller's own, if they've shared
// one with it, so a group's Lists tab is the full picture of what's visible
// there rather than just what everyone else brought. Membership-gated so only
// someone who can see the group's roster can see what's shared with it.
export const sharedWithGroup = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!(await getMembership(ctx, args.groupId, user._id))) return null;

    const shares = await ctx.db.query('listShares').withIndex('by_group', q => q.eq('sharedWithGroupId', args.groupId)).collect();
    return await resolveSharedLists(ctx, shares);
  },
});

// Lists shared with an event - mirrors sharedWithGroup above.
export const sharedWithEvent = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!(await getAttendance(ctx, args.eventId, user._id))) return null;

    const shares = await ctx.db.query('listShares').withIndex('by_event', q => q.eq('sharedWithEventId', args.eventId)).collect();
    return await resolveSharedLists(ctx, shares);
  },
});

async function resolveSharedLists(ctx: QueryCtx, shares: Doc<'listShares'>[]) {
  const lists = await Promise.all(
    shares.map(async share => {
      const list = await ctx.db.get(share.listId);
      if (!list) return null;
      const owner = await authComponent.getAnyUserById(ctx, list.createdBy);
      return { ...list, owner: { name: owner?.name ?? 'Unknown', image: owner?.image ?? null } };
    })
  );
  return lists.filter((l): l is NonNullable<typeof l> => l !== null);
}
