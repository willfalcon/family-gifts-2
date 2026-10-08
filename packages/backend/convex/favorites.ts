import { v, ConvexError } from 'convex/values';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { hasListAccess } from './listShares';
import { getMembership } from './groups';
import { getAttendance } from './events';

// Every favorite row, resolved to display info for whichever target it
// points at. A row whose target no longer exists, or that the user no longer
// has access to (e.g. a revoked list share), is silently skipped rather than
// surfaced as an error - it just quietly stops showing up, same as any other
// list that's filtered down to what's currently visible.
export const myFavorites = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const rows = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const resolved = await Promise.all(
      rows.map(async (row) => {
        if (row.favoritedUserId) {
          const target = await authComponent.getAnyUserById(ctx, row.favoritedUserId);
          if (!target) return null;
          return {
            id: row._id,
            kind: 'user' as const,
            targetId: row.favoritedUserId,
            title: target.name,
            image: target.image ?? null,
          };
        }
        if (row.favoritedListId) {
          const list = await ctx.db.get(row.favoritedListId);
          if (!list || !(await hasListAccess(ctx, list, user._id))) return null;
          return { id: row._id, kind: 'list' as const, targetId: list._id, title: list.title };
        }
        if (row.favoritedGroupId) {
          const group = await ctx.db.get(row.favoritedGroupId);
          if (!group || !(await getMembership(ctx, group._id, user._id))) return null;
          return { id: row._id, kind: 'group' as const, targetId: group._id, title: group.name };
        }
        if (row.favoritedEventId) {
          const event = await ctx.db.get(row.favoritedEventId);
          if (!event || !(await getAttendance(ctx, event._id, user._id))) return null;
          return { id: row._id, kind: 'event' as const, targetId: event._id, title: event.name };
        }
        return null;
      })
    );

    return resolved.filter((f): f is NonNullable<typeof f> => f !== null);
  },
});

// Favoriting a user profile - can't favorite yourself, and the target must
// actually exist (it comes from a profile page the client already rendered,
// but the id itself is untrusted input).
export const toggleUserFavorite = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (args.id === user._id) {
      throw new ConvexError("You can't favorite yourself.");
    }
    if (!(await authComponent.getAnyUserById(ctx, args.id))) {
      throw new Error('User not found');
    }

    const existing = await ctx.db
      .query('favorites')
      .withIndex('by_user_favoritedUserId', (q) => q.eq('userId', user._id).eq('favoritedUserId', args.id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert('favorites', { userId: user._id, favoritedUserId: args.id });
    return true;
  },
});

// Favoriting a list - restricted to lists the user can already see (their
// own, or shared with them), same visibility rule as lists.get.
export const toggleListFavorite = mutation({
  args: { id: v.id('lists') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const list = await ctx.db.get(args.id);
    if (!list || !(await hasListAccess(ctx, list, user._id))) {
      throw new Error('List not found');
    }

    const existing = await ctx.db
      .query('favorites')
      .withIndex('by_user_favoritedListId', (q) => q.eq('userId', user._id).eq('favoritedListId', args.id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert('favorites', { userId: user._id, favoritedListId: args.id });
    return true;
  },
});

// Favoriting a group - restricted to groups the user is a member of.
export const toggleGroupFavorite = mutation({
  args: { id: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!(await getMembership(ctx, args.id, user._id))) {
      throw new Error('Group not found');
    }

    const existing = await ctx.db
      .query('favorites')
      .withIndex('by_user_favoritedGroupId', (q) => q.eq('userId', user._id).eq('favoritedGroupId', args.id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert('favorites', { userId: user._id, favoritedGroupId: args.id });
    return true;
  },
});

// Favoriting an event - restricted to events the user attends.
export const toggleEventFavorite = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!(await getAttendance(ctx, args.id, user._id))) {
      throw new Error('Event not found');
    }

    const existing = await ctx.db
      .query('favorites')
      .withIndex('by_user_favoritedEventId', (q) => q.eq('userId', user._id).eq('favoritedEventId', args.id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert('favorites', { userId: user._id, favoritedEventId: args.id });
    return true;
  },
});
