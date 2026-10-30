import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getGroupByInviteToken, joinGroupByLink } from './groups';
import { answerInvite, getEventByInviteToken, joinEventByLink } from './events';

// The public /invite/$token page doesn't know ahead of time what a token is:
// an email invite to a group or event, or a group's or event's shareable join
// link ('groupLink' / 'eventLink' - no email, anyone holding it can join). So
// this fans out to all four and reports which one matched. Delegates to
// groups.ts/events.ts rather than duplicating their invite-resolution logic.
type InvitePreview =
  | { kind: 'group'; groupId: Id<'groups'>; groupName: string; email: string }
  | { kind: 'groupLink'; groupId: Id<'groups'>; groupName: string }
  | { kind: 'event'; eventId: Id<'events'>; eventName: string; email: string }
  | { kind: 'eventLink'; eventId: Id<'events'>; eventName: string }
  | null;

export const getPreview = query({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<InvitePreview> => {
    const groupPreview = await ctx.runQuery(api.groups.getInvitePreview, { token: args.token });
    if (groupPreview) return { kind: 'group' as const, ...groupPreview };

    const linkGroup = await getGroupByInviteToken(ctx, args.token);
    if (linkGroup) return { kind: 'groupLink' as const, groupId: linkGroup._id, groupName: linkGroup.name };

    const eventPreview = await ctx.runQuery(api.events.getInvitePreview, { token: args.token });
    if (eventPreview) return { kind: 'event' as const, ...eventPreview };

    const linkEvent = await getEventByInviteToken(ctx, args.token);
    if (linkEvent) return { kind: 'eventLink' as const, eventId: linkEvent._id, eventName: linkEvent.name };

    return null;
  },
});

// Answers an invite as the signed-in user, routing to the right table based
// on which one has a row for this token (regardless of its status - the
// underlying function is what validates pending/email-match and throws the
// right ConvexError for the invite page to show). `status` is the event
// answer - going or can't go - and defaults to going; groups ignore it.
export const accept = mutation({
  args: {
    token: v.string(),
    status: v.optional(v.union(v.literal('going'), v.literal('declined'))),
  },
  handler: async (ctx, args): Promise<{ kind: 'group'; id: Id<'groups'> } | { kind: 'event'; id: Id<'events'> }> => {
    const status = args.status ?? 'going';

    const groupInvite = await ctx.db
      .query('groupInvites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (groupInvite) {
      const groupId = await ctx.runMutation(api.groups.acceptInvite, { token: args.token });
      return { kind: 'group', id: groupId };
    }

    const linkGroup = await getGroupByInviteToken(ctx, args.token);
    if (linkGroup) {
      const user = await authComponent.getAuthUser(ctx);
      return { kind: 'group', id: await joinGroupByLink(ctx, user._id, linkGroup) };
    }

    const eventInvite = await ctx.db
      .query('eventAttendees')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (eventInvite) {
      return { kind: 'event', id: await answerInvite(ctx, args.token, status) };
    }

    const linkEvent = await getEventByInviteToken(ctx, args.token);
    if (linkEvent) {
      const user = await authComponent.getAuthUser(ctx);
      return { kind: 'event', id: await joinEventByLink(ctx, user._id, linkEvent, status) };
    }

    throw new ConvexError('This invite is no longer valid.');
  },
});
