import { v, ConvexError } from 'convex/values';
import { mutation, query, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getMembership } from './groups';
import { getConnections } from './connections';
import { isDiscoverable, searchDiscoverable } from './people';
import { pickAvatarColor } from './avatarColors';
import { deleteSecretSanta, drawIfEveryoneReplied } from './secretSanta';
import { deleteEventNotices } from './notices';

// The user's row on the event, if they've accepted or declined an invite (or
// created the event). Any such row grants access to the event - an emailed
// invite that hasn't been answered has no userId, so it never matches.
// Exported for convex/listShares.ts, which needs to check event attendance
// when resolving whether an event-shared list is visible to a given user.
export async function getAttendance(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  return await ctx.db
    .query('eventAttendees')
    .withIndex('by_event_user', q => q.eq('eventId', eventId).eq('userId', userId))
    .unique();
}

// Whether an attendance row can run the event (owner or host).
export function isHostRole(role: Doc<'eventAttendees'>['role']) {
  return role === 'owner' || role === 'host';
}

// An avatar color that avoids the event's other current colors where possible
// (mirrors groups.ts's addMember).
async function nextColor(ctx: QueryCtx, eventId: Id<'events'>) {
  const rows = await ctx.db
    .query('eventAttendees')
    .withIndex('by_event', q => q.eq('eventId', eventId))
    .collect();
  return pickAvatarColor(rows.map(a => a.color));
}

// The join-link token lets anyone in, so it's stripped from every event doc
// sent to a client. getInviteLink hands it out only to people allowed to share it.
function toClientEvent({ inviteToken: _inviteToken, ...event }: Doc<'events'>) {
  return event;
}

function inviteUrl(token: string) {
  return `${process.env.SITE_URL}/invite/${token}`;
}

// The invite row behind an invite link, if it's still unanswered.
async function getOpenInvite(ctx: QueryCtx, token: string) {
  const row = await ctx.db
    .query('eventAttendees')
    .withIndex('by_token', q => q.eq('token', token))
    .unique();
  if (!row || row.status !== 'invited') return null;
  const event = await ctx.db.get(row.eventId);
  return event && event.cancelledAt === undefined ? row : null;
}

// Throws unless `userId` is the event's owner or a host. Mirrors
// groups.ts's requireManager - see that file for why this is centralized.
// Exported for convex/secretSanta.ts, which needs the same host check.
export async function requireHost(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  const attendance = await getAttendance(ctx, eventId, userId);
  if (!attendance || !isHostRole(attendance.role)) {
    throw new Error('Event not found');
  }
  return attendance;
}

// Throws unless `userId` is the event's owner specifically - for deleting the
// event or transferring ownership, which even a host shouldn't be able to do.
async function requireOwner(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  const attendance = await getAttendance(ctx, eventId, userId);
  if (!attendance || attendance.role !== 'owner') {
    throw new Error('Event not found');
  }
  return attendance;
}

// Lists events the current user attends - as owner, host, or guest, not
// just ones they created - so an invited attendee sees the event too. Each
// comes with the viewer's role and whether they've archived it, so lists can
// offer the right actions.
export const myEvents = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.getAuthUser(ctx);
    const attendances = await ctx.db
      .query('eventAttendees')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect();

    const events = await Promise.all(
      attendances.map(async attendance => {
        const event = await ctx.db.get(attendance.eventId);
        if (!event) return null;
        return { ...toClientEvent(event), myRole: attendance.role, archived: attendance.archivedAt !== undefined };
      }),
    );
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

    return { ...toClientEvent(event), archived: attendance.archivedAt !== undefined };
  },
});

const eventFieldsValidator = {
  name: v.string(),
  description: v.optional(v.string()),
  date: v.optional(v.string()),
  endDate: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  location: v.optional(v.string()),
};

// Creating an event also seats the creator as its first attendee, with the
// 'owner' role - otherwise the event would have no attendees and `get` could
// never surface it back to them.
export const create = mutation({
  args: eventFieldsValidator,
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const eventId = await ctx.db.insert('events', {
      ...args,
      createdBy: user._id,
      inviteToken: crypto.randomUUID(),
      guestsCanInvite: false,
    });
    await ctx.db.insert('eventAttendees', {
      eventId,
      userId: user._id,
      role: 'owner',
      status: 'going',
      color: await nextColor(ctx, eventId),
    });
    return eventId;
  },
});

// Editing an event's details is a host-level action. Every editable field is
// replaced, so leaving one out clears it (patching with undefined removes a
// field) - that's how a form removes a date, time, or location.
export const update = mutation({
  args: { id: v.id('events'), ...eventFieldsValidator },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.id, user._id);

    await ctx.db.patch(args.id, {
      name: args.name,
      description: args.description,
      date: args.date,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      location: args.location,
    });
  },
});

// Cancels the event for everyone. It stays on attendees' lists marked as
// cancelled, and its invites and join link stop working, but nothing is
// deleted - a host can restore it.
export const cancel = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.id, user._id);
    const event = await ctx.db.get(args.id);
    if (!event || event.cancelledAt !== undefined) return;
    await ctx.db.patch(args.id, { cancelledAt: Date.now() });
  },
});

// Undoes `cancel`.
export const restore = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.id, user._id);
    await ctx.db.patch(args.id, { cancelledAt: undefined });
  },
});

// Moves the event into the Archived section of the caller's own events list.
// Any attendee can do this; it changes nothing for anyone else.
export const archive = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.id, user._id);
    if (!attendance) throw new Error('Event not found');
    if (attendance.archivedAt !== undefined) return;
    await ctx.db.patch(attendance._id, { archivedAt: Date.now() });
  },
});

// Undoes `archive`.
export const unarchive = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.id, user._id);
    if (!attendance) throw new Error('Event not found');
    await ctx.db.patch(attendance._id, { archivedAt: undefined });
  },
});

// Deletes an event along with everything that hangs off it - its guest list
// (invites included), and any list shares pointed at it - so nothing
// orphaned is left behind.
export const remove = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireOwner(ctx, args.id, user._id);

    for await (const attendee of ctx.db.query('eventAttendees').withIndex('by_event', q => q.eq('eventId', args.id))) {
      await ctx.db.delete(attendee._id);
    }
    for await (const groupInvite of ctx.db
      .query('eventGroupInvites')
      .withIndex('by_event_group', q => q.eq('eventId', args.id))) {
      await ctx.db.delete(groupInvite._id);
    }
    for await (const share of ctx.db
      .query('listShares')
      .withIndex('by_event', q => q.eq('sharedWithEventId', args.id))) {
      await ctx.db.delete(share._id);
    }
    for await (const favorite of ctx.db
      .query('favorites')
      .withIndex('by_favoritedEventId', q => q.eq('favoritedEventId', args.id))) {
      await ctx.db.delete(favorite._id);
    }

    await deleteSecretSanta(ctx, args.id);
    await deleteEventNotices(ctx, args.id);

    await ctx.db.delete(args.id);
  },
});

// The event's roster - everyone who has answered (going or not), with
// display info. Unanswered invites are in listInvites. Returns null if the
// current user isn't an attendee, so the event page can render a "not found"
// state instead of leaking who's attending an event they can't see.
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

    const answered = attendees.flatMap(a => (a.userId ? [{ ...a, userId: a.userId }] : []));
    return await Promise.all(
      answered.map(async attendee => {
        const attendeeUser = await authComponent.getAnyUserById(ctx, attendee.userId);
        return {
          id: attendee._id,
          userId: attendee.userId,
          role: attendee.role,
          // Answered rows are only ever going or declined.
          status: attendee.status === 'declined' ? ('declined' as const) : ('going' as const),
          color: attendee.color,
          name: attendeeUser?.name ?? 'Unknown',
          image: attendeeUser?.image ?? null,
        };
      }),
    );
  },
});

// Invites nobody has answered yet, with the source group's name attached
// when the invite came from inviting a whole group. Host-only, since email
// addresses are more sensitive than the roster itself.
export const listInvites = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    const rows = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();

    const invites = rows.filter(row => row.status === 'invited' && row.email);
    return await Promise.all(
      invites.map(async invite => {
        const sourceGroup = invite.sourceGroupId ? await ctx.db.get(invite.sourceGroupId) : null;
        return { _id: invite._id, email: invite.email!, sourceGroupName: sourceGroup?.name ?? null };
      }),
    );
  },
});

// How many invites are still unanswered. Any attendee can see the number;
// the emails behind it stay host-only (see listInvites).
export const pendingInviteCount = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.eventId, user._id);
    if (!attendance) return null;

    let count = 0;
    for await (const row of ctx.db.query('eventAttendees').withIndex('by_event', q => q.eq('eventId', args.eventId))) {
      if (row.status === 'invited') count++;
    }
    return count;
  },
});

// Invitees (invited, no reply yet) as any attendee may see them. Someone with
// an account shows by full name if they're discoverable or a connection of
// the viewer, and by first name otherwise. Invitees with no account are only
// counted for guests; hosts also get each invitee's email and source group.
// Returns null if the viewer isn't on the event.
export const listInvitees = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const viewerAttendance = await getAttendance(ctx, args.eventId, user._id);
    if (!viewerAttendance) return null;
    const isHost = isHostRole(viewerAttendance.role);

    const rows = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();
    const invites = rows.filter(row => row.status === 'invited' && row.email);
    if (invites.length === 0) return { invitees: [], withoutAccount: 0 };

    const connections = await getConnections(ctx, user._id);
    const resolved = await Promise.all(
      invites.map(async invite => {
        const email = invite.email!;
        const profile = await ctx.db
          .query('profiles')
          .withIndex('by_email', q => q.eq('email', email))
          .first();
        const person = profile ? await authComponent.getAnyUserById(ctx, profile.userId) : null;
        let name: string | null = null;
        if (profile && person) {
          const showFullName = profile.discoverable === true || connections.has(profile.userId);
          name = showFullName ? person.name : person.name.split(' ')[0];
        }
        const sourceGroup = isHost && invite.sourceGroupId ? await ctx.db.get(invite.sourceGroupId) : null;
        return {
          id: invite._id,
          name,
          color: invite.color,
          email: isHost ? email : null,
          fromGroupName: sourceGroup?.name ?? null,
        };
      }),
    );

    // Guests never see an email, so invitees without an account are only counted.
    const visible = isHost ? resolved : resolved.filter(invitee => invitee.name !== null);
    visible.sort((a, b) => {
      if (a.name !== null && b.name !== null) return a.name.localeCompare(b.name);
      if (a.name !== null) return -1;
      if (b.name !== null) return 1;
      return (a.email ?? '').localeCompare(b.email ?? '');
    });
    return { invitees: visible, withoutAccount: resolved.length - visible.length };
  },
});

// Invites an email to the event and schedules the invite email. Returns null
// (and sends nothing) if that email has already answered. Inviting an email
// that's still unanswered sends a fresh link and retires the old one, so at
// most one link per (event, email) ever works. A revoked invite is reopened.
async function createInvite(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  email: string,
  invitedBy: string,
  sourceGroupId?: Id<'groups'>,
) {
  const event = await ctx.db.get(eventId);
  if (event?.cancelledAt !== undefined) {
    throw new ConvexError('This event is cancelled. Restore it to invite people.');
  }
  const existing = await ctx.db
    .query('eventAttendees')
    .withIndex('by_event_email', q => q.eq('eventId', eventId).eq('email', email))
    .first();
  if (existing && existing.status !== 'invited' && existing.status !== 'revoked') return null;

  const fields = { status: 'invited' as const, token: crypto.randomUUID(), invitedBy, sourceGroupId };
  let inviteId: Id<'eventAttendees'>;
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    inviteId = existing._id;
  } else {
    inviteId = await ctx.db.insert('eventAttendees', {
      eventId,
      email,
      role: 'guest',
      color: await nextColor(ctx, eventId),
      ...fields,
    });
  }

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
    await requireHost(ctx, args.eventId, user._id);

    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new ConvexError('Email is required');
    }

    const inviteId = await createInvite(ctx, args.eventId, email, user._id);
    if (!inviteId) {
      throw new ConvexError(`${email} is already on the guest list.`);
    }
    return inviteId;
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
    await requireHost(ctx, args.eventId, user._id);

    const group = await ctx.db.get(args.groupId);
    // The caller must belong to the group too - otherwise anyone holding a
    // group's id could email all its members and put their event on its page.
    if (!group || !(await getMembership(ctx, args.groupId, user._id))) {
      throw new Error('Group not found');
    }

    const members = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', q => q.eq('groupId', args.groupId))
      .collect();

    const existingAttendees = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();
    // Members already on the event - answered, or invited and not yet
    // answered - are skipped, so they don't get another email. Revoked
    // invitees are invited again.
    const alreadyOnEvent = new Set(
      existingAttendees.flatMap(a => (a.status === 'revoked' ? [] : [a.userId, a.email].filter(Boolean))),
    );

    let invited = 0;
    for (const member of members) {
      if (alreadyOnEvent.has(member.userId)) continue;

      const memberUser = await authComponent.getAnyUserById(ctx, member.userId);
      if (!memberUser) continue;
      const email = memberUser.email.toLowerCase();
      if (alreadyOnEvent.has(email)) continue;

      if (await createInvite(ctx, args.eventId, email, user._id, args.groupId)) {
        invited++;
      }
    }

    // Record the group-level invite so the group page can show this event.
    const existing = await ctx.db
      .query('eventGroupInvites')
      .withIndex('by_event_group', q => q.eq('eventId', args.eventId).eq('groupId', args.groupId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { invitedBy: user._id, invitedAt: Date.now() });
    } else {
      await ctx.db.insert('eventGroupInvites', {
        eventId: args.eventId,
        groupId: args.groupId,
        invitedBy: user._id,
        invitedAt: Date.now(),
      });
    }

    return { invited, total: members.length };
  },
});

// People the user could invite to an event: everyone they share a group or
// event with, most connections first. With `eventId`, anyone already on that
// event (or with an open invite) is left out; a revoked invitee isn't. `search` matches a name, or an
// email - emails are matched here and never sent back, since they're more
// sensitive than names.
export const knownPeople = query({
  args: { eventId: v.optional(v.id('events')), search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (args.eventId) await requireHost(ctx, args.eventId, user._id);

    const connections = await getConnections(ctx, user._id);
    const eventRows = args.eventId
      ? await ctx.db
          .query('eventAttendees')
          .withIndex('by_event', q => q.eq('eventId', args.eventId!))
          .collect()
      : [];
    // A revoked invitee can be suggested again.
    const onEvent = new Set(
      eventRows.flatMap(row => (row.status === 'revoked' ? [] : [row.userId, row.email].filter(Boolean))),
    );
    const search = args.search?.trim().toLowerCase() ?? '';

    const people = await Promise.all(
      [...connections].map(async ([userId, counts]) => {
        const person = await authComponent.getAnyUserById(ctx, userId);
        if (!person) return null;
        const email = person.email.toLowerCase();
        if (onEvent.has(userId) || onEvent.has(email)) return null;
        if (search && !person.name.toLowerCase().includes(search) && !email.includes(search)) return null;
        return {
          userId,
          name: person.name,
          image: person.image ?? null,
          color: counts.color,
          sharedGroups: counts.sharedGroups,
          sharedEvents: counts.sharedEvents,
          emailMatch: email === search,
        };
      }),
    );

    const known = people
      .filter(person => person !== null)
      .sort(
        (a, b) => b.sharedGroups + b.sharedEvents - (a.sharedGroups + a.sharedEvents) || a.name.localeCompare(b.name),
      );
    if (!search) return known;

    // While searching, also find people outside the viewer's circle who've
    // chosen to be findable. They come after the people the viewer knows.
    const others = await searchDiscoverable(
      ctx,
      user._id,
      search,
      (userId, email) => onEvent.has(userId) || onEvent.has(email) || connections.has(userId),
    );
    return [...known, ...others];
  },
});

// Invites someone the host already knows (shares a group or event with), or
// who has chosen to be findable, by their account, so the client never needs
// their email address.
export const inviteUser = mutation({
  args: { eventId: v.id('events'), userId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    // Same "not found" for strangers and missing users, so this can't be used
    // to probe who has an account.
    const connections = await getConnections(ctx, user._id);
    const canFind =
      args.userId !== user._id && (connections.has(args.userId) || (await isDiscoverable(ctx, args.userId)));
    const person = canFind ? await authComponent.getAnyUserById(ctx, args.userId) : null;
    if (!person) throw new ConvexError('Person not found');

    if (await getAttendance(ctx, args.eventId, args.userId)) {
      throw new ConvexError(`${person.name} is already on the guest list.`);
    }
    const inviteId = await createInvite(ctx, args.eventId, person.email.toLowerCase(), user._id);
    if (!inviteId) throw new ConvexError(`${person.name} is already on the guest list.`);
    return inviteId;
  },
});

// Lets a host take back an invite nobody has answered yet. The row is kept,
// marked 'revoked', and its token is cleared so the emailed link stops working.
export const revokeInvite = mutation({
  args: { id: v.id('eventAttendees') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const invite = await ctx.db.get(args.id);
    if (!invite || invite.status !== 'invited') throw new ConvexError('Invite not found');
    await requireHost(ctx, invite.eventId, user._id);

    await ctx.db.patch(args.id, { status: 'revoked', token: undefined });
    await drawIfEveryoneReplied(ctx, invite.eventId);
  },
});

// Sets whether the signed-in user is going. "Can't go anymore" keeps them on
// the event - they can still see it and its lists, and change their mind.
export const setMyStatus = mutation({
  args: { eventId: v.id('events'), status: v.union(v.literal('going'), v.literal('declined')) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.eventId, user._id);
    if (!attendance) throw new Error('Event not found');

    await ctx.db.patch(attendance._id, { status: args.status });
  },
});

// Removes an attendee's association with the event (their account itself is
// untouched). The owner can't be removed this way - ownership must be
// transferred first, so an event is never left ownerless.
export const removeAttendee = mutation({
  args: { eventId: v.id('events'), attendeeId: v.id('eventAttendees') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

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
    await drawIfEveryoneReplied(ctx, args.eventId);
  },
});

// Promotes a guest to host, or demotes a host back to guest. The owner's role
// can't be changed this way (transfer ownership instead), and a host can't
// change their own role - otherwise a host could demote themselves (or the
// only other host) and leave the event with no one able to run it.
export const setAttendeeRole = mutation({
  args: {
    eventId: v.id('events'),
    attendeeId: v.id('eventAttendees'),
    role: v.union(v.literal('host'), v.literal('guest')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

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

// Hands ownership to an existing host; the caller (the current owner)
// becomes a host themselves, so there's always exactly one owner and the
// caller keeps host-level access to the event they used to own.
export const transferOwnership = mutation({
  args: { eventId: v.id('events'), attendeeId: v.id('eventAttendees') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const ownerAttendance = await requireOwner(ctx, args.eventId, user._id);

    const target = await ctx.db.get(args.attendeeId);
    if (!target || target.eventId !== args.eventId) {
      throw new Error('Attendee not found');
    }
    if (target.role !== 'host') {
      throw new ConvexError('Ownership can only be transferred to an existing host.');
    }

    await ctx.db.patch(target._id, { role: 'owner' });
    await ctx.db.patch(ownerAttendance._id, { role: 'host' });
  },
});

// The event's shareable join link, plus the settings around it. Returns null
// for a bad id or a non-attendee. `url` is null when the viewer isn't allowed
// to share the link (a guest while guestsCanInvite is off), or when the event
// predates links and a host hasn't generated one yet.
export const getInviteLink = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const eventId = ctx.db.normalizeId('events', args.eventId);
    const event = eventId && (await ctx.db.get(eventId));
    if (!event) return null;
    const attendance = await getAttendance(ctx, event._id, user._id);
    if (!attendance) return null;

    const canManage = isHostRole(attendance.role);
    const guestsCanInvite = event.guestsCanInvite ?? false;
    const canShare = canManage || guestsCanInvite;

    return {
      url: canShare && event.inviteToken ? inviteUrl(event.inviteToken) : null,
      guestsCanInvite,
      canManage,
    };
  },
});

// Turns "guests can invite" on or off. Host-only.
export const setGuestsCanInvite = mutation({
  args: { eventId: v.id('events'), guestsCanInvite: v.boolean() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);
    await ctx.db.patch(args.eventId, { guestsCanInvite: args.guestsCanInvite });
  },
});

// Swaps in a new join-link token, so the old link stops working. Host-only.
// Also how events created before links existed get their first one.
export const resetInviteLink = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);
    const inviteToken = crypto.randomUUID();
    await ctx.db.patch(args.eventId, { inviteToken });
    return inviteUrl(inviteToken);
  },
});

// Looks up an event by its join-link token. Shared by invites.getPreview and
// invites.accept, which handle every kind of invite token.
// A cancelled event's link doesn't work.
export async function getEventByInviteToken(ctx: QueryCtx, token: string) {
  const event = await ctx.db
    .query('events')
    .withIndex('by_inviteToken', q => q.eq('inviteToken', token))
    .unique();
  return event && event.cancelledAt === undefined ? event : null;
}

// Answers an event's join link as the signed-in user: puts them on the guest
// list as going or not. Unlike an email invite there's no address to match -
// holding the current link is enough. If they're already on the event, this
// just updates their answer.
export async function joinEventByLink(
  ctx: MutationCtx,
  userId: string,
  event: Doc<'events'>,
  status: 'going' | 'declined',
) {
  const existing = await getAttendance(ctx, event._id, userId);
  if (existing) {
    await ctx.db.patch(existing._id, { status });
  } else {
    await ctx.db.insert('eventAttendees', {
      eventId: event._id,
      userId,
      role: 'guest',
      status,
      color: await nextColor(ctx, event._id),
    });
  }
  return event._id;
}

// Public preview of an invite, keyed by the unguessable token in the invite
// link - no attendance check, since the caller may not even have an account
// yet. Returns null for a missing/already-answered invite so the invite page
// can render "this invite is no longer valid" instead of an error.
export const getInvitePreview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await getOpenInvite(ctx, args.token);
    if (!invite?.email) return null;

    const event = await ctx.db.get(invite.eventId);
    if (!event) return null;

    return { eventId: event._id, eventName: event.name, email: invite.email };
  },
});

// Answers an invite as the signed-in user: links the row to their account and
// records whether they're going. The invite's email must match the caller's
// own account email - otherwise anyone holding the link (it travels over
// email, which can be forwarded) could answer on someone else's behalf.
export async function answerInvite(ctx: MutationCtx, token: string, status: 'going' | 'declined') {
  return await answerOpenInvite(ctx, await getOpenInvite(ctx, token), status);
}

// Answers an unanswered invite row as the signed-in user, who must be the
// email it was sent to.
async function answerOpenInvite(ctx: MutationCtx, invite: Doc<'eventAttendees'> | null, status: 'going' | 'declined') {
  const user = await authComponent.getAuthUser(ctx);
  if (!invite || invite.status !== 'invited') {
    throw new ConvexError('This invite is no longer valid.');
  }
  if (invite.email !== user.email.toLowerCase()) {
    throw new ConvexError(`This invite was sent to ${invite.email}. Sign in with that email to answer it.`);
  }

  // Already on the event some other way (say, invited under an email they
  // didn't sign up with): keep that row and drop this one.
  const existing = await getAttendance(ctx, invite.eventId, user._id);
  if (existing) {
    await ctx.db.patch(existing._id, { status });
    await ctx.db.delete(invite._id);
  } else {
    await ctx.db.patch(invite._id, { userId: user._id, status, token: undefined });
  }
  await drawIfEveryoneReplied(ctx, invite.eventId);
  return invite.eventId;
}

// The signed-in user's unanswered invites (matched on their email), soonest
// event first, for the home screen. Capped - nobody needs more than a handful.
export const myInvites = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query('eventAttendees')
      .withIndex('by_email_status', q => q.eq('email', user.email.toLowerCase()).eq('status', 'invited'))
      .take(20);

    const invites = await Promise.all(
      rows.map(async row => {
        const event = await ctx.db.get(row.eventId);
        if (!event || event.cancelledAt !== undefined) return null;
        // Already on the event some other way - nothing to answer.
        if (await getAttendance(ctx, event._id, user._id)) return null;
        const inviter = row.invitedBy ? await authComponent.getAnyUserById(ctx, row.invitedBy) : null;
        return { _id: row._id, invitedByName: inviter?.name ?? null, event: toClientEvent(event) };
      }),
    );
    return invites
      .filter(invite => invite !== null)
      .sort((a, b) => (a.event.date ?? '\uffff').localeCompare(b.event.date ?? '\uffff'));
  },
});

// Answers one of the signed-in user's own invites (from myInvites) without
// needing the emailed link.
export const answerMyInvite = mutation({
  args: { id: v.id('eventAttendees'), status: v.union(v.literal('going'), v.literal('declined')) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const invite = await ctx.db.get(args.id);
    // Someone else's invite reads as invalid rather than naming their email.
    const mine = invite?.email === user.email.toLowerCase() ? invite : null;
    return await answerOpenInvite(ctx, mine, args.status);
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => await answerInvite(ctx, args.token, 'going'),
});

// Declining still puts the event in the person's app, marked "Can't go", so
// hosts see a "no" instead of an invite that sits unanswered forever.
export const declineInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => await answerInvite(ctx, args.token, 'declined'),
});

// Feeds the Node action that renders and sends the invite email; actions have
// no ctx.db, so this is the only way for it to read invite/event/inviter data.
export const getInviteEmailData = internalQuery({
  args: { inviteId: v.id('eventAttendees') },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite?.email || !invite.token || invite.status !== 'invited') return null;
    const event = await ctx.db.get(invite.eventId);
    if (!event) return null;
    const inviter = invite.invitedBy ? await authComponent.getAnyUserById(ctx, invite.invitedBy) : null;

    return {
      email: invite.email,
      token: invite.token,
      eventName: event.name,
      inviterName: inviter?.name ?? 'Someone',
    };
  },
});
