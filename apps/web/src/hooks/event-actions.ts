import { useMutation } from 'convex/react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { confirm, showError } from '@/components/alerts';

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (e) {
    showError('Couldn’t update event', e);
  }
}

type EventLike = { _id: Id<'events'>; name: string; cancelledAt?: number };

// Cancel, restore, archive and delete for one event, with the confirmations
// each needs. Shared by the events list rows and the event page, like mobile's
// hooks/event-actions.ts. `onDeleted` runs after a delete succeeds.
export function useEventActions(event: EventLike | null | undefined, onDeleted?: () => void) {
  const cancelEvent = useMutation(api.events.cancel);
  const restoreEvent = useMutation(api.events.restore);
  const archiveEvent = useMutation(api.events.archive);
  const unarchiveEvent = useMutation(api.events.unarchive);
  const deleteEvent = useMutation(api.events.remove);

  async function confirmCancel() {
    if (!event) return;
    const ok = await confirm({
      title: `Cancel ${event.name}?`,
      message:
        'Everyone will see it’s cancelled, and its invites and link stop working. Nothing is deleted, so you can restore it later.',
      confirmText: 'Cancel event',
      cancelText: 'Keep event',
      destructive: true,
    });
    if (ok) await run(() => cancelEvent({ id: event._id }));
  }

  function restore() {
    if (event) void run(() => restoreEvent({ id: event._id }));
  }

  function archive() {
    if (event) void run(() => archiveEvent({ id: event._id }));
  }

  function unarchive() {
    if (event) void run(() => unarchiveEvent({ id: event._id }));
  }

  async function confirmDelete() {
    if (!event) return;
    const ok = await confirm({
      title: `Delete ${event.name}?`,
      message:
        'This removes the event for everyone, along with its invites and Secret Santa. Lists shared with it are kept. This can’t be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteEvent({ id: event._id });
      onDeleted?.();
    } catch (e) {
      showError('Couldn’t update event', e);
    }
  }

  return { confirmCancel, restore, archive, unarchive, confirmDelete };
}
