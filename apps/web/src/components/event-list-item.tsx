import { Link, useNavigate } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar, ChevronRight } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { formatRelativeDay, formatWhen } from '@shared/event-dates';
import { InviteAnswerButtons, type MyInvite } from '@/components/home';
import { ActionsMenu } from '@/components/page';
import { isHostRole } from '@/hooks/data';
import { useEventActions } from '@/hooks/event-actions';
import { cn } from '@/lib/utils';

export type EventRow = FunctionReturnType<typeof api.events.myEvents>[number];

// The weekday over the day of the month, or a calendar for undated events.
function DateBadge({ date }: { date: string | undefined | null }) {
  // parseISO reads "YYYY-MM-DD" as local midnight, so the day doesn't shift.
  const parsed = date ? parseISO(date) : null;
  const start = parsed && isValid(parsed) ? parsed : null;
  return (
    <span className="flex w-11 shrink-0 flex-col items-center justify-center">
      {start ? (
        <>
          <span className="text-[11px] leading-[13px] font-semibold text-ink-muted">{format(start, 'EEE')}</span>
          <span className="text-[22px] leading-[26px] font-semibold text-ink-muted">{format(start, 'd')}</span>
        </>
      ) : (
        <Calendar className="size-5 text-ink-muted" />
      )}
    </span>
  );
}

// A row on the Events page. Mobile's swipe and long-press actions are in the
// "…" menu: edit (hosts), archive, cancel/restore (hosts), delete (owner).
export function EventListItem({ event, past = false }: { event: EventRow; past?: boolean }) {
  const navigate = useNavigate();
  const { confirmCancel, restore, archive, unarchive, confirmDelete } = useEventActions(event);
  const isHost = isHostRole(event.myRole);
  const isOwner = event.myRole === 'owner';
  const cancelled = event.cancelledAt !== undefined;
  const muted = past || cancelled || event.archived;
  // "in 12 days" for upcoming events; past and cancelled ones just show their date.
  const relative = event.date && !muted ? formatRelativeDay(event.date) : null;

  return (
    <div className="flex items-center gap-2">
      <Link to="/events/$id" params={{ id: event._id }} className="flex min-w-0 flex-1 items-center gap-3 py-1">
        <DateBadge date={event.date} />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-line pt-2 pb-3">
          <span className="min-w-0 flex-1">
            <span className={cn('block font-semibold', muted && 'text-ink-muted', cancelled && 'line-through')}>
              {event.name}
            </span>
            <span className="block text-sm text-ink-muted">
              {cancelled ? `Cancelled · ${formatWhen(event)}` : formatWhen(event)}
            </span>
          </span>
          <span className="flex items-center gap-1">
            {relative && <span className="text-sm text-accent">{relative}</span>}
            <ChevronRight className="size-4 text-ink-faint" />
          </span>
        </span>
      </Link>
      <ActionsMenu
        label={`Options for ${event.name}`}
        actions={[
          isHost && { label: 'Edit', onSelect: () => navigate({ to: '/events/$id/edit', params: { id: event._id } }) },
          event.archived ? { label: 'Unarchive', onSelect: unarchive } : { label: 'Archive', onSelect: archive },
          isHost &&
            (cancelled
              ? { label: 'Restore event', onSelect: restore }
              : { label: 'Cancel event', onSelect: () => void confirmCancel(), destructive: true }),
          isOwner && { label: 'Delete event', onSelect: () => void confirmDelete(), destructive: true },
        ]}
      />
    </div>
  );
}

// A pending invite on the Events page, laid out like EventListItem but with
// the answer buttons underneath instead of a link (the event can't be opened
// until it's answered).
export function InvitationListItem({ invite }: { invite: MyInvite }) {
  const { event } = invite;
  const relative = event.date ? formatRelativeDay(event.date) : null;
  return (
    <div className="flex gap-3 py-1">
      <span className="pt-2">
        <DateBadge date={event.date} />
      </span>
      <div className="flex flex-1 flex-col gap-3 border-b border-line pt-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold">{event.name}</p>
            <p className="text-sm text-ink-muted">{formatWhen(event)}</p>
            {invite.invitedByName && <p className="text-sm text-ink-muted">Invited by {invite.invitedByName}</p>}
          </div>
          {relative && <span className="text-sm text-accent">{relative}</span>}
        </div>
        <InviteAnswerButtons inviteId={invite._id} />
      </div>
    </div>
  );
}
