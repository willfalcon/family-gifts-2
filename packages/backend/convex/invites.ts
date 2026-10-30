import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getGroupByInviteToken, joinGroupByLink } from './groups';

// The public /invite/$token page doesn't know ahead of time whether a token
// is an email invite to a group or event, or a group's shareable join link
// ('groupLink' - no email, anyone holding it can join), so this fans out to
// all three and reports which one matched. Delegates to groups.ts/events.ts rather than duplicating their
// invite-resolution logic here.
type InvitePreview =
  | { kind: 'group'; groupId: Id<'groups'>; groupName: string; email: string }
  | { kind: 'groupLink'; groupId: Id<'groups'>; groupName: string }
  | { kind: 'event'; eventId: Id<'events'>; eventName: string; email: string }
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

    return null;
  },
});

// Routes acceptance to groups.acceptInvite or events.acceptInvite based on
// which table actually has a row for this token (regardless of its status -
// the underlying mutation is what validates pending/expired/email-match and
// throws the right ConvexError for the invite page to show).
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ kind: 'group'; id: Id<'groups'> } | { kind: 'event'; id: Id<'events'> }> => {
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
      .query('eventInvites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (eventInvite) {
      const eventId = await ctx.runMutation(api.events.acceptInvite, { token: args.token });
      return { kind: 'event', id: eventId };
    }

    throw new ConvexError('This invite is no longer valid.');
  },
});
