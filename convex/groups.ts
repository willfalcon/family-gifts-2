import { v, ConvexError } from 'convex/values';
import { mutation, query, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { pickAvatarColor } from './avatarColors';

// Exported for convex/listShares.ts, which needs to check group membership
// when resolving whether a group-shared list is visible to a given user.
export async function getMembership(ctx: QueryCtx, groupId: Id<'groups'>, userId: string) {
  return await ctx.db
    .query('groupMembers')
    .withIndex('by_group_user', q => q.eq('groupId', groupId).eq('userId', userId))
    .unique();
}

// Throws unless `userId` is the group's owner or a manager. Centralized
// because this check appears in several mutations below and an authz check
// is the wrong place to let copy-paste drift happen.
async function requireManager(ctx: QueryCtx, groupId: Id<'groups'>, userId: string) {
  const membership = await getMembership(ctx, groupId, userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    throw new Error('Group not found');
  }
  return membership;
}

// Throws unless `userId` is the group's owner specifically - for the handful
// of actions (deleting the group, transferring ownership) that even a
// manager shouldn't be able to do.
async function requireOwner(ctx: QueryCtx, groupId: Id<'groups'>, userId: string) {
  const membership = await getMembership(ctx, groupId, userId);
  if (!membership || membership.role !== 'owner') {
    throw new Error('Group not found');
  }
  return membership;
}

// Seats a user in a group, picking an avatar color that avoids the group's
// other current colors where possible. Centralized so `create` (the founding
// owner) and `acceptInvite` (everyone after) can't pick colors independently
// and defeat the "no repeats until exhausted" intent.
async function addMember(ctx: MutationCtx, groupId: Id<'groups'>, userId: string, role: 'owner' | 'member') {
  const existingMembers = await ctx.db
    .query('groupMembers')
    .withIndex('by_group', q => q.eq('groupId', groupId))
    .collect();
  const color = pickAvatarColor(existingMembers.map(m => m.color));
  await ctx.db.insert('groupMembers', { groupId, userId, role, color });
}

// Groups the user belongs to (any role) - not just ones they created. A
// `createdBy`-based query would miss groups joined via invite, or ones whose
// ownership has since been transferred away from the original creator.
export const myGroups = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.getAuthUser(ctx);
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect();
    const groups = await Promise.all(memberships.map(m => ctx.db.get(m.groupId)));
    return groups.filter((g): g is NonNullable<typeof g> => g !== null);
  },
});

// Gets a single group by id. Returns null if the id is malformed, doesn't
// exist, or the current user isn't a member, so callers can render a
// "not found" state. `id` comes from a URL param, so it's untrusted input -
// take it as a string and normalize rather than v.id('groups'), which would
// throw ArgumentValidationError on anything the user can edit in the address bar.
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const id = ctx.db.normalizeId('groups', args.id);
    const group = id && (await ctx.db.get(id));
    if (!group) return null;

    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', q => q.eq('groupId', group._id).eq('userId', user._id))
      .unique();
    if (!membership) return null;

    return group;
  },
});

// Creating a group also seats the creator as its first (and initially only)
// member, with the 'owner' role - otherwise the group would have no members
// and `myGroups`/`get` could never surface it back to them.
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const groupId = await ctx.db.insert('groups', { ...args, createdBy: user._id });
    await addMember(ctx, groupId, user._id, 'owner');
    return groupId;
  },
});

// Renaming a group is a manager-level action, not just any member, since
// membership alone (role 'member') shouldn't grant control over shared state.
export const update = mutation({
  args: { id: v.id('groups'), name: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.id, user._id);

    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

// Deletes a group along with everything that hangs off it - its memberships,
// pending invites, and any list shares pointed at it - so nothing orphaned is
// left behind.
export const remove = mutation({
  args: { id: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireOwner(ctx, args.id, user._id);

    for await (const member of ctx.db.query('groupMembers').withIndex('by_group', q => q.eq('groupId', args.id))) {
      await ctx.db.delete(member._id);
    }
    for await (const invite of ctx.db.query('groupInvites').withIndex('by_group', q => q.eq('groupId', args.id))) {
      await ctx.db.delete(invite._id);
    }
    for await (const share of ctx.db.query('listShares').withIndex('by_group', q => q.eq('sharedWithGroupId', args.id))) {
      await ctx.db.delete(share._id);
    }
    for await (const favorite of ctx.db.query('favorites').withIndex('by_favoritedGroupId', q => q.eq('favoritedGroupId', args.id))) {
      await ctx.db.delete(favorite._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Members of a group, with display info for the roster. Returns null if the
// current user isn't a member, so the group page can render a "not found"
// state instead of leaking membership of a group the viewer can't see into.
export const listMembers = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const viewerMembership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', q => q.eq('groupId', args.groupId).eq('userId', user._id))
      .unique();
    if (!viewerMembership) return null;

    const members = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', q => q.eq('groupId', args.groupId))
      .collect();

    return await Promise.all(
      members.map(async member => {
        const memberUser = await authComponent.getAnyUserById(ctx, member.userId);
        return {
          id: member._id,
          userId: member.userId,
          role: member.role,
          color: member.color,
          name: memberUser?.name ?? 'Unknown',
          image: memberUser?.image ?? null,
        };
      })
    );
  },
});

// Pending invites for a group. Manager-only, since the list of who's been
// invited (their email addresses) is more sensitive than the roster itself.
export const listInvites = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.groupId, user._id);

    return await ctx.db
      .query('groupInvites')
      .withIndex('by_group', q => q.eq('groupId', args.groupId))
      .filter(q => q.eq(q.field('status'), 'pending'))
      .collect();
  },
});

// Invites an email address to join a group, and schedules the invite email.
// Sending happens in a separate scheduled action (see sendGroupInviteEmail.tsx)
// since mutations can't call actions directly, and react-email's renderer
// needs a Node action anyway.
export const invite = mutation({
  args: { groupId: v.id('groups'), email: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.groupId, user._id);

    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }

    // Superseding any earlier pending invite to this address keeps at most one
    // live link per (group, email), so an old link can't be used after a
    // fresh one was sent.
    for await (const existing of ctx.db
      .query('groupInvites')
      .withIndex('by_group_email', q => q.eq('groupId', args.groupId).eq('email', email))) {
      if (existing.status === 'pending') {
        await ctx.db.patch(existing._id, { status: 'revoked' });
      }
    }

    const inviteId = await ctx.db.insert('groupInvites', {
      groupId: args.groupId,
      email,
      token: crypto.randomUUID(),
      invitedBy: user._id,
      status: 'pending',
    });

    await ctx.scheduler.runAfter(0, internal.sendGroupInviteEmail.sendGroupInviteEmail, { inviteId });
    return inviteId;
  },
});

// Lets a manager undo an invite before it's accepted.
export const revokeInvite = mutation({
  args: { id: v.id('groupInvites') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const invite = await ctx.db.get(args.id);
    if (!invite) throw new Error('Invite not found');
    await requireManager(ctx, invite.groupId, user._id);

    await ctx.db.patch(args.id, { status: 'revoked' });
  },
});

// Removes a member's association with the group (their account itself is
// untouched). The owner can't be removed this way - ownership must be
// transferred first, so a group is never left ownerless.
export const removeMember = mutation({
  args: { groupId: v.id('groups'), memberId: v.id('groupMembers') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.groupId, user._id);

    const target = await ctx.db.get(args.memberId);
    if (!target || target.groupId !== args.groupId) {
      throw new Error('Member not found');
    }
    if (target.role === 'owner') {
      throw new ConvexError("The group owner can't be removed - transfer ownership first.");
    }
    if (target.userId === user._id) {
      throw new ConvexError("You can't remove yourself from the group.");
    }

    await ctx.db.delete(args.memberId);
  },
});

// Promotes a member to manager, or demotes a manager back to member. The
// owner's role can't be changed this way (transfer ownership instead), and a
// manager can't change their own role - otherwise a manager could demote
// themselves (or the only other manager) and leave the group with no one
// able to manage it.
export const setMemberRole = mutation({
  args: { groupId: v.id('groups'), memberId: v.id('groupMembers'), role: v.union(v.literal('manager'), v.literal('member')) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.groupId, user._id);

    const target = await ctx.db.get(args.memberId);
    if (!target || target.groupId !== args.groupId) {
      throw new Error('Member not found');
    }
    if (target.role === 'owner') {
      throw new ConvexError("The owner's role can't be changed this way - transfer ownership first.");
    }
    if (target.userId === user._id) {
      throw new ConvexError("You can't change your own role.");
    }

    await ctx.db.patch(args.memberId, { role: args.role });
  },
});

// Hands ownership to an existing manager; the caller (the current owner)
// becomes a manager themselves, so there's always exactly one owner and the
// caller keeps manager-level access to the group they used to own.
export const transferOwnership = mutation({
  args: { groupId: v.id('groups'), memberId: v.id('groupMembers') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const ownerMembership = await requireOwner(ctx, args.groupId, user._id);

    const target = await ctx.db.get(args.memberId);
    if (!target || target.groupId !== args.groupId) {
      throw new Error('Member not found');
    }
    if (target.role !== 'manager') {
      throw new ConvexError('Ownership can only be transferred to an existing manager.');
    }

    await ctx.db.patch(target._id, { role: 'owner' });
    await ctx.db.patch(ownerMembership._id, { role: 'manager' });
  },
});

// Public preview of an invite, keyed by the unguessable token in the invite
// link - no membership check, since the caller may not even have an account
// yet. Returns null for a missing/already-resolved invite so the invite page
// can render "this invite is no longer valid" instead of an error.
export const getInvitePreview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query('groupInvites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (!invite || invite.status !== 'pending') return null;

    const group = await ctx.db.get(invite.groupId);
    if (!group) return null;

    return { groupId: group._id, groupName: group.name, email: invite.email };
  },
});

// Accepts an invite for the signed-in user. The invite's email must match the
// caller's own account email - otherwise anyone holding the link (it travels
// over email, which can be forwarded) could join on someone else's behalf.
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const invite = await ctx.db
      .query('groupInvites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (!invite || invite.status !== 'pending') {
      // ConvexError (not a plain Error), since these two messages are shown
      // to the user directly on the invite page - plain Error messages are
      // redacted to a generic "Server Error" for the client.
      throw new ConvexError('This invite is no longer valid.');
    }
    if (invite.email !== user.email.toLowerCase()) {
      throw new ConvexError(`This invite was sent to ${invite.email}. Sign in with that email to accept it.`);
    }

    const existingMembership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', q => q.eq('groupId', invite.groupId).eq('userId', user._id))
      .unique();
    if (!existingMembership) {
      await addMember(ctx, invite.groupId, user._id, 'member');
    }
    await ctx.db.patch(invite._id, { status: 'accepted' });

    return invite.groupId;
  },
});

// Feeds the Node action that renders and sends the invite email; actions have
// no ctx.db, so this is the only way for it to read invite/group/inviter data.
export const getInviteEmailData = internalQuery({
  args: { inviteId: v.id('groupInvites') },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return null;
    const group = await ctx.db.get(invite.groupId);
    if (!group) return null;
    const inviter = await authComponent.getAnyUserById(ctx, invite.invitedBy);

    return {
      email: invite.email,
      token: invite.token,
      groupName: group.name,
      inviterName: inviter?.name ?? 'Someone',
    };
  },
});
