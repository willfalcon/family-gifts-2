import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';

export function useEvents() {
  const { data: events } = useSuspenseQuery(convexQuery(api.events.myEvents, {}));
  return { events };
}

export function useEvent(id: string) {
  const { data: event } = useSuspenseQuery(convexQuery(api.events.get, { id }));
  return { event };
}

export function useEventAttendees(eventId: Id<'events'>) {
  const { data: attendees } = useSuspenseQuery(convexQuery(api.events.listAttendees, { eventId }));
  return { attendees };
}

export function useEventInvites(eventId: Id<'events'>) {
  const { data: invites } = useSuspenseQuery(convexQuery(api.events.listInvites, { eventId }));
  return { invites };
}

export function useEventSharedLists(eventId: Id<'events'>) {
  const { data: lists } = useSuspenseQuery(convexQuery(api.listShares.sharedWithEvent, { eventId }));
  return { lists };
}
