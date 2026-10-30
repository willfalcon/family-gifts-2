import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';

// One-off: creates eventGroupInvites rows for groups invited to events before
// that table existed, using the `sourceGroupId` on each member's eventInvite.
// Each (event, group) row takes the newest matching invite's time and inviter.
// Safe to re-run. Processes a page at a time and schedules itself for the next.
// Run with: npx convex run backfills:eventGroupInvites
export const eventGroupInvites = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query('eventInvites').paginate({ numItems: 200, cursor: args.cursor ?? null });

    for (const invite of page.page) {
      const groupId = invite.sourceGroupId;
      if (!groupId) continue;
      // Skip invites whose event or group has since been deleted.
      if (!(await ctx.db.get(invite.eventId)) || !(await ctx.db.get(groupId))) continue;

      const existing = await ctx.db
        .query('eventGroupInvites')
        .withIndex('by_event_group', q => q.eq('eventId', invite.eventId).eq('groupId', groupId))
        .unique();
      if (!existing) {
        await ctx.db.insert('eventGroupInvites', {
          eventId: invite.eventId,
          groupId,
          invitedBy: invite.invitedBy,
          invitedAt: invite._creationTime,
        });
      } else if (existing.invitedAt < invite._creationTime) {
        await ctx.db.patch(existing._id, { invitedBy: invite.invitedBy, invitedAt: invite._creationTime });
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.backfills.eventGroupInvites, { cursor: page.continueCursor });
    }
    return null;
  },
});
