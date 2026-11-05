import type { QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';

// Everyone the user shares a group or an event with, keyed by user id, with
// how many groups and events they share. Events only count people who've
// answered (an unanswered invite has no account linked yet).
export async function getConnections(ctx: QueryCtx, userId: string) {
  const people = new Map<string, { sharedGroups: number; sharedEvents: number; color: Doc<'groupMembers'>['color'] }>();
  const note = (otherId: string, kind: 'sharedGroups' | 'sharedEvents', color: Doc<'groupMembers'>['color']) => {
    if (otherId === userId) return;
    const person = people.get(otherId) ?? { sharedGroups: 0, sharedEvents: 0, color };
    person[kind]++;
    people.set(otherId, person);
  };

  const memberships = await ctx.db
    .query('groupMembers')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect();
  for (const membership of memberships) {
    for await (const member of ctx.db
      .query('groupMembers')
      .withIndex('by_group', q => q.eq('groupId', membership.groupId))) {
      note(member.userId, 'sharedGroups', member.color);
    }
  }

  const attendances = await ctx.db
    .query('eventAttendees')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect();
  for (const attendance of attendances) {
    for await (const attendee of ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', attendance.eventId))) {
      if (attendee.userId) note(attendee.userId, 'sharedEvents', attendee.color);
    }
  }

  return people;
}

// Whether two people are Connections: they share a group, or both have
// replied to the same event.
export async function areConnected(ctx: QueryCtx, userId: string, otherId: string) {
  if (userId === otherId) return false;
  for await (const membership of ctx.db.query('groupMembers').withIndex('by_user', q => q.eq('userId', userId))) {
    const other = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', q => q.eq('groupId', membership.groupId).eq('userId', otherId))
      .first();
    if (other) return true;
  }
  for await (const attendance of ctx.db.query('eventAttendees').withIndex('by_user', q => q.eq('userId', userId))) {
    const other = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event_user', q => q.eq('eventId', attendance.eventId).eq('userId', otherId))
      .first();
    if (other) return true;
  }
  return false;
}
