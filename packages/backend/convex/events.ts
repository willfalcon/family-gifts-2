import { v, ConvexError } from 'convex/values';
import { mutation, query, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { pickAvatarColor } from './avatarColors';

// Exported for convex/listShares.ts, which needs to check event attendance
// when resolving whether an event-shared list is visible to a given user.
export async function getAttendance(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  return await ctx.db
    .query('eventAttendees')
    .withIndex('by_event_user', q => q.eq('eventId', eventId).eq('userId', userId))
    .unique();
}

// Throws unless `userId` is the event's owner or a manager. Mirrors
// groups.ts's requireManager - see that file for why this is centralized.
// Exported for convex/secretSanta.ts, which needs the same manager check.
export async function requireManager(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  const attendance = await getAttendance(ctx, eventId, userId);
  if (!attendance || (attendance.role !== 'owner' && attendance.role !== 'manager')) {
    throw new Error('Event not found');
  }
  return attendance;
}

// Throws unless `userId` is the event's owner specifically - for deleting the
// event or transferring ownership, which even a manager shouldn't be able to do.
async function requireOwner(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  const attendance = await getAttendance(ctx, eventId, userId);
  if (!attendance || attendance.role !== 'owner') {
    throw new Error('Event not found');
  }
  return attendance;
}

// Seats a user as an event attendee, picking an avatar color that avoids the
// event's other current colors where possible (mirrors groups.ts's addMember).
async function addAttendee(ctx: MutationCtx, eventId: Id<'events'>, userId: string, role: 'owner' | 'guest') {
  const existingAttendees = await ctx.db
    .query('eventAttendees')
    .withIndex('by_event', q => q.eq('eventId', eventId))
    .collect();
  const color = pickAvatarColor(existingAttendees.map(a => a.color));
  await ctx.db.insert('eventAttendees', { eventId, userId, role, color });
}

// Lists events the current user attends - as owner, manager, or guest, not
// just ones they created - so an invited attendee sees the event too.
export const myEvents = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.getAuthUser(ctx);
    const attendances = await ctx.db
      .query('eventAttendees')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect();

    const events = await Promise.all(attendances.map(attendance => ctx.db.get(attendance.eventId)));
    return events.filter(event => event !== null);
  },
});

// Gets a single event by id. Returns null if the id is malformed, doesn't
// exist, or the current user isn't an attendee, so callers can render a
// "not found" state. `id` comes from a URL param, so it's untrusted input -
// take it as a string and normalize rather than v.id('events'), which would
// throw ArgumentValidationError on anything the user can edit in the address bar.
// Returns null (rather than throwing) when signed out or not an attendee, so
// the route can render a not-found state instead of an error boundary.
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const id = ctx.db.normalizeId('events', args.id);
    const event = id && (await ctx.db.get(id));
    if (!event) return null;

    const attendance = await getAttendance(ctx, event._id, user._id);
    if (!attendance) return null;

    return event;
  },
});

const eventFieldsValidator = {
  name: v.string(),
  description: v.optional(v.string()),
  date: v.optional(v.string()),
  endDate: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
};

// Creating an event also seats the creator as its first attendee, with the
// 'owner' role - otherwise the event would have no attendees and `get` could
// never surface it back to them.
export const create = mutation({
  args: eventFieldsValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const eventId = await ctx.db.insert('events', { ...args, createdBy: user._id });
    await addAttendee(ctx, eventId, user._id, 'owner');
    return eventId;
  },
});

// Editing an event's details is a manager-level action.
export const update = mutation({
  args: { id: v.id('events'), ...eventFieldsValidator },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.id, user._id);

    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

// Deletes an event along with everything that hangs off it - its attendees,
// pending invites, and any list shares pointed at it - so nothing orphaned is
// left behind.
export const remove = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireOwner(ctx, args.id, user._id);

    for await (const attendee of ctx.db.query('eventAttendees').withIndex('by_event', q => q.eq('eventId', args.id))) {
      await ctx.db.delete(attendee._id);
    }
    for await (const invite of ctx.db.query('eventInvites').withIndex('by_event', q => q.eq('eventId', args.id))) {
      await ctx.db.delete(invite._id);
    }
    for await (const share of ctx.db.query('listShares').withIndex('by_event', q => q.eq('sharedWithEventId', args.id))) {
      await ctx.db.delete(share._id);
    }
    for await (const favorite of ctx.db.query('favorites').withIndex('by_favoritedEventId', q => q.eq('favoritedEventId', args.id))) {
      await ctx.db.delete(favorite._id);
    }

    const secretSanta = await ctx.db
      .query('secretSantas')
      .withIndex('by_event', q => q.eq('eventId', args.id))
      .unique();
    if (secretSanta) {
      for await (const row of ctx.db.query('secretSantaParticipants').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
        await ctx.db.delete(row._id);
      }
      for await (const row of ctx.db.query('secretSantaExclusions').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
        await ctx.db.delete(row._id);
      }
      for await (const row of ctx.db.query('secretSantaAssignments').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
        await ctx.db.delete(row._id);
      }
      await ctx.db.delete(secretSanta._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Attendees of an event, with display info for the roster. Returns null if
// the current user isn't an attendee, so the event page can render a
// "not found" state instead of leaking who's attending an event they can't see.
export const listAttendees = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const viewerAttendance = await getAttendance(ctx, args.eventId, user._id);
    if (!viewerAttendance) return null;

    const attendees = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();

    return await Promise.all(
      attendees.map(async attendee => {
        const attendeeUser = await authComponent.getAnyUserById(ctx, attendee.userId);
        return {
          id: attendee._id,
          userId: attendee.userId,
          role: attendee.role,
          color: attendee.color,
          name: attendeeUser?.name ?? 'Unknown',
          image: attendeeUser?.image ?? null,
        };
      })
    );
  },
});

// Pending invites for an event, with the source group's name attached when
// the invite came from inviting a whole group. Manager-only, since email
// addresses are more sensitive than the roster itself.
export const listInvites = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.eventId, user._id);

    const invites = await ctx.db
      .query('eventInvites')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .filter(q => q.eq(q.field('status'), 'pending'))
      .collect();

    return await Promise.all(
      invites.map(async invite => {
        const sourceGroup = invite.sourceGroupId ? await ctx.db.get(invite.sourceGroupId) : null;
        return { ...invite, sourceGroupName: sourceGroup?.name ?? null };
      })
    );
  },
});

async function createInvite(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  email: string,
  invitedBy: string,
  sourceGroupId?: Id<'groups'>
) {
  // Superseding any earlier pending invite to this address keeps at most one
  // live link per (event, email), so an old link can't be used after a fresh one.
  for await (const existing of ctx.db.query('eventInvites').withIndex('by_event_email', q => q.eq('eventId', eventId).eq('email', email))) {
    if (existing.status === 'pending') {
      await ctx.db.patch(existing._id, { status: 'revoked' });
    }
  }

  const inviteId = await ctx.db.insert('eventInvites', {
    eventId,
    email,
    token: crypto.randomUUID(),
    invitedBy,
    status: 'pending',
    sourceGroupId,
  });

  await ctx.scheduler.runAfter(0, internal.sendEventInviteEmail.sendEventInviteEmail, { inviteId });
  return inviteId;
}

// Invites a single email address to an event, and schedules the invite email.
// Sending happens in a separate scheduled action (see sendEventInviteEmail.tsx)
// since mutations can't call actions directly, and react-email's renderer
// needs a Node action anyway.
export const invite = mutation({
  args: { eventId: v.id('events'), email: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.eventId, user._id);

    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }

    return await createInvite(ctx, args.eventId, email, user._id);
  },
});

// Invites every current member of a group to the event in one action - each
// gets their own individual invite email, exactly like inviting them one by
// one. Not a live link: members who join the group later aren't retroactively
// invited, and removing them from the group later doesn't touch the event.
export const inviteGroup = mutation({
  args: { eventId: v.id('events'), groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.eventId, user._id);

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error('Group not found');

    const members = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', q => q.eq('groupId', args.groupId))
      .collect();

    const existingAttendees = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();
    const attendeeUserIds = new Set(existingAttendees.map(a => a.userId));

    let invited = 0;
    for (const member of members) {
      if (attendeeUserIds.has(member.userId)) continue;

      const memberUser = await authComponent.getAnyUserById(ctx, member.userId);
      if (!memberUser) continue;

      await createInvite(ctx, args.eventId, memberUser.email.toLowerCase(), user._id, args.groupId);
      invited++;
    }

    return { invited, total: members.length };
  },
});

// Lets a manager undo an invite before it's accepted.
export const revokeInvite = mutation({
  args: { id: v.id('eventInvites') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const invite = await ctx.db.get(args.id);
    if (!invite) throw new Error('Invite not found');
    await requireManager(ctx, invite.eventId, user._id);

    await ctx.db.patch(args.id, { status: 'revoked' });
  },
});

// Removes an attendee's association with the event (their account itself is
// untouched). The owner can't be removed this way - ownership must be
// transferred first, so an event is never left ownerless.
export const removeAttendee = mutation({
  args: { eventId: v.id('events'), attendeeId: v.id('eventAttendees') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.eventId, user._id);

    const target = await ctx.db.get(args.attendeeId);
    if (!target || target.eventId !== args.eventId) {
      throw new Error('Attendee not found');
    }
    if (target.role === 'owner') {
      throw new ConvexError("The event owner can't be removed - transfer ownership first.");
    }
    if (target.userId === user._id) {
      throw new ConvexError("You can't remove yourself from the event.");
    }

    await ctx.db.delete(args.attendeeId);
  },
});

// Promotes a guest to manager, or demotes a manager back to guest. The
// owner's role can't be changed this way (transfer ownership instead), and a
// manager can't change their own role - otherwise a manager could demote
// themselves (or the only other manager) and leave the event with no one
// able to manage it.
export const setAttendeeRole = mutation({
  args: { eventId: v.id('events'), attendeeId: v.id('eventAttendees'), role: v.union(v.literal('manager'), v.literal('guest')) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.eventId, user._id);

    const target = await ctx.db.get(args.attendeeId);
    if (!target || target.eventId !== args.eventId) {
      throw new Error('Attendee not found');
    }
    if (target.role === 'owner') {
      throw new ConvexError("The owner's role can't be changed this way - transfer ownership first.");
    }
    if (target.userId === user._id) {
      throw new ConvexError("You can't change your own role.");
    }

    await ctx.db.patch(args.attendeeId, { role: args.role });
  },
});

// Hands ownership to an existing manager; the caller (the current owner)
// becomes a manager themselves, so there's always exactly one owner and the
// caller keeps manager-level access to the event they used to own.
export const transferOwnership = mutation({
  args: { eventId: v.id('events'), attendeeId: v.id('eventAttendees') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const ownerAttendance = await requireOwner(ctx, args.eventId, user._id);

    const target = await ctx.db.get(args.attendeeId);
    if (!target || target.eventId !== args.eventId) {
      throw new Error('Attendee not found');
    }
    if (target.role !== 'manager') {
      throw new ConvexError('Ownership can only be transferred to an existing manager.');
    }

    await ctx.db.patch(target._id, { role: 'owner' });
    await ctx.db.patch(ownerAttendance._id, { role: 'manager' });
  },
});

// Public preview of an invite, keyed by the unguessable token in the invite
// link - no attendance check, since the caller may not even have an account
// yet. Returns null for a missing/already-resolved invite so the invite page
// can render "this invite is no longer valid" instead of an error.
export const getInvitePreview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query('eventInvites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (!invite || invite.status !== 'pending') return null;

    const event = await ctx.db.get(invite.eventId);
    if (!event) return null;

    return { eventId: event._id, eventName: event.name, email: invite.email };
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
      .query('eventInvites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .unique();
    if (!invite || invite.status !== 'pending') {
      throw new ConvexError('This invite is no longer valid.');
    }
    if (invite.email !== user.email.toLowerCase()) {
      throw new ConvexError(`This invite was sent to ${invite.email}. Sign in with that email to accept it.`);
    }

    const existingAttendance = await getAttendance(ctx, invite.eventId, user._id);
    if (!existingAttendance) {
      await addAttendee(ctx, invite.eventId, user._id, 'guest');
    }
    await ctx.db.patch(invite._id, { status: 'accepted' });

    return invite.eventId;
  },
});

// Feeds the Node action that renders and sends the invite email; actions have
// no ctx.db, so this is the only way for it to read invite/event/inviter data.
export const getInviteEmailData = internalQuery({
  args: { inviteId: v.id('eventInvites') },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return null;
    const event = await ctx.db.get(invite.eventId);
    if (!event) return null;
    const inviter = await authComponent.getAnyUserById(ctx, invite.invitedBy);

    return {
      email: invite.email,
      token: invite.token,
      eventName: event.name,
      inviterName: inviter?.name ?? 'Someone',
    };
  },
});
