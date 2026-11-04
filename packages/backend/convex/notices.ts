import { v, ConvexError } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { authComponent } from './auth';

// Tells someone a host undid the Secret Santa draw they were in. One per
// person per event - undoing again doesn't stack up cards.
export async function addSecretSantaUndoneNotice(ctx: MutationCtx, userId: string, eventId: Id<'events'>) {
  const existing = await ctx.db
    .query('notices')
    .withIndex('by_user_event', q => q.eq('userId', userId).eq('eventId', eventId))
    .filter(q => q.eq(q.field('kind'), 'secretSantaUndone'))
    .first();
  if (!existing) await ctx.db.insert('notices', { userId, kind: 'secretSantaUndone', eventId });
}

// Tells every host on the event that a scheduled Reviewed draw happened and
// the names are waiting to be sent.
export async function addSecretSantaDrawnNotices(ctx: MutationCtx, eventId: Id<'events'>, hostUserIds: string[]) {
  for (const userId of hostUserIds) {
    const existing = await ctx.db
      .query('notices')
      .withIndex('by_user_event', q => q.eq('userId', userId).eq('eventId', eventId))
      .filter(q => q.eq(q.field('kind'), 'secretSantaDrawn'))
      .first();
    if (!existing) await ctx.db.insert('notices', { userId, kind: 'secretSantaDrawn', eventId });
  }
}

// Once the names are sent or the draw is undone, there's nothing left to review.
export async function clearSecretSantaDrawnNotices(ctx: MutationCtx, eventId: Id<'events'>) {
  for await (const notice of ctx.db.query('notices').withIndex('by_event', q => q.eq('eventId', eventId))) {
    if (notice.kind === 'secretSantaDrawn') await ctx.db.delete(notice._id);
  }
}

// Used by events.remove.
export async function deleteEventNotices(ctx: MutationCtx, eventId: Id<'events'>) {
  for await (const notice of ctx.db.query('notices').withIndex('by_event', q => q.eq('eventId', eventId))) {
    await ctx.db.delete(notice._id);
  }
}

// The signed-in user's notices for the home screen, newest first.
export const mine = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const notices = await ctx.db
      .query('notices')
      .withIndex('by_user_event', q => q.eq('userId', user._id))
      .take(20);

    const withEvents = await Promise.all(
      notices.map(async notice => {
        const event = await ctx.db.get(notice.eventId);
        if (!event) return null;
        return {
          _id: notice._id,
          _creationTime: notice._creationTime,
          kind: notice.kind,
          eventId: event._id,
          eventName: event.name,
        };
      }),
    );
    return withEvents.filter(n => n !== null).sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const dismiss = mutation({
  args: { id: v.id('notices') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const notice = await ctx.db.get(args.id);
    if (!notice) return;
    if (notice.userId !== user._id) throw new ConvexError('Notice not found.');
    await ctx.db.delete(notice._id);
  },
});
