import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Alert } from 'react-native';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';

// Shows the server's message for expected failures (ConvexError), a generic one otherwise.
export function showEventError(e: unknown) {
  const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
  Alert.alert('Couldn’t update event', message);
}

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (e) {
    showEventError(e);
  }
}

type EventLike = { _id: Id<'events'>; name: string; cancelledAt?: number };

// Cancel, restore, archive and delete for one event, with the confirmations
// and error alerts each needs. Shared by the events list rows and the event
// screen so both say the same thing. `onDeleted` runs after a delete
// succeeds (the event screen uses it to leave the page).
export function useEventActions(event: EventLike | null | undefined, onDeleted?: () => void) {
  const cancelEvent = useMutation(api.events.cancel);
  const restoreEvent = useMutation(api.events.restore);
  const archiveEvent = useMutation(api.events.archive);
  const unarchiveEvent = useMutation(api.events.unarchive);
  const deleteEvent = useMutation(api.events.remove);

  function confirmCancel() {
    if (!event) return;
    Alert.alert(
      `Cancel ${event.name}?`,
      'Everyone will see it’s cancelled, and its invites and link stop working. Nothing is deleted, so you can restore it later.',
      [
        { text: 'Keep event', style: 'cancel' },
        { text: 'Cancel event', style: 'destructive', onPress: () => run(() => cancelEvent({ id: event._id })) },
      ],
    );
  }

  function restore() {
    if (!event) return;
    run(() => restoreEvent({ id: event._id }));
  }

  function archive() {
    if (!event) return;
    run(() => archiveEvent({ id: event._id }));
  }

  function unarchive() {
    if (!event) return;
    run(() => unarchiveEvent({ id: event._id }));
  }

  function confirmDelete() {
    if (!event) return;
    Alert.alert(
      `Delete ${event.name}?`,
      'This removes the event for everyone, along with its invites and Secret Santa. Lists shared with it are kept. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent({ id: event._id });
              onDeleted?.();
            } catch (e) {
              showEventError(e);
            }
          },
        },
      ],
    );
  }

  return { confirmCancel, restore, archive, unarchive, confirmDelete };
}

export type EventRole = Doc<'eventAttendees'>['role'];

export function isHostRole(role: EventRole | undefined) {
  return role === 'owner' || role === 'host';
}
