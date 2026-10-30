import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export function useEvents() {
  return useQuery(api.events.myEvents);
}

// A single event. undefined while loading, null if it doesn't exist or the
// viewer isn't attending.
// Pass undefined to skip.
export function useEvent(id: string | undefined) {
  return useQuery(api.events.get, id ? { id } : 'skip');
}

// The event's roster. Pass undefined to skip (e.g. while the event loads).
export function useEventAttendees(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.listAttendees, eventId ? { eventId } : 'skip');
}

// Pending email invites. Manager-only on the server, so only ask when the
// viewer can manage the event.
export function useEventInvites(eventId: Id<'events'> | undefined, canManage: boolean) {
  return useQuery(api.events.listInvites, eventId && canManage ? { eventId } : 'skip');
}

// How many invites are still unanswered. null for a non-attendee.
export function useEventPendingInviteCount(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.pendingInviteCount, eventId ? { eventId } : 'skip');
}

// Lists with this event as their occasion that the viewer can open; the
// viewer's own come last.
export function useEventOccasionLists(eventId: Id<'events'> | undefined) {
  return useQuery(api.lists.forEvent, eventId ? { eventId } : 'skip');
}

// Lists attendees have shared with the event.
export function useEventSharedLists(eventId: Id<'events'> | undefined) {
  return useQuery(api.listShares.sharedWithEvent, eventId ? { eventId } : 'skip');
}

// The viewer's local date as "YYYY-MM-DD", for splitting upcoming from past.
export function localToday() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The event's join link and its settings. undefined while loading, null for a
// non-attendee. `url` is null when the viewer isn't allowed to share it (or a
// host hasn't created one yet for an older event).
export function useEventInviteLink(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.getInviteLink, eventId ? { eventId } : 'skip');
}

// People the viewer shares a group or event with, most connections first,
// leaving out anyone already on `eventId`. `search` matches name or email.
export function useKnownPeople(eventId: Id<'events'> | undefined, search?: string) {
  return useQuery(api.events.knownPeople, { eventId, search });
}
