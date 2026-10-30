import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from 'react';

import type { Id } from '@convex/_generated/dataModel';

// Someone picked to invite. Known people are invited by account, so the app
// never needs their email; anyone else is invited by the email typed in.
export type Guest = { kind: 'user'; userId: string; name: string } | { kind: 'email'; email: string; name: string };

export function guestKey(guest: Guest) {
  return guest.kind === 'user' ? guest.userId : guest.email;
}

type SaveResult = { id: Id<'events'> } | { error: string };

interface EventDraft {
  guests: Guest[];
  addGuest: (guest: Guest) => void;
  removeGuest: (key: string) => void;
  // Set once the event has been saved before the form is finished (to share
  // its invite link). The form then updates that event instead of creating one.
  eventId: Id<'events'> | undefined;
  setEventId: (id: Id<'events'>) => void;
  // Set by the event form: saves the event as filled in so far.
  saveEvent: RefObject<(() => Promise<SaveResult>) | null>;
}

const EventDraftContext = createContext<EventDraft | null>(null);

// Shared by the new-event form and the Add People screen it opens, which are
// separate screens in the same modal.
export function EventDraftProvider({ children }: { children: ReactNode }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [eventId, setEventId] = useState<Id<'events'>>();
  const saveEvent = useRef<(() => Promise<SaveResult>) | null>(null);

  const addGuest = (guest: Guest) =>
    setGuests(list => (list.some(g => guestKey(g) === guestKey(guest)) ? list : [...list, guest]));
  const removeGuest = (key: string) => setGuests(list => list.filter(g => guestKey(g) !== key));

  return (
    <EventDraftContext.Provider value={{ guests, addGuest, removeGuest, eventId, setEventId, saveEvent }}>
      {children}
    </EventDraftContext.Provider>
  );
}

// null outside a new-event flow (e.g. when editing an event).
export function useEventDraft() {
  return useContext(EventDraftContext);
}
