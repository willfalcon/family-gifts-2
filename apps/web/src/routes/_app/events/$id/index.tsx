import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { format } from 'date-fns';
import { Check, ChevronRight, MessageCircle, Pencil, Plus } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { formatShortDate, formatWhen } from '@shared/event-dates';
import { capitalize, plural } from '@shared/utils';
import { confirm, showError } from '@/components/alerts';
import { Avatar, AvatarStack } from '@/components/avatar';
import { copyLink } from '@/components/guest-picker';
import { ActionsMenu, NotFound, Page, PageHeader, Section } from '@/components/page';
import { AskForIdeasDialog } from '@/components/sheets';
import { Button } from '@/components/ui/button';
import {
  useEvent,
  useEventAttendees,
  useEventInviteLink,
  useEventInvitees,
  useEventOccasionLists,
  useEventPendingInviteCount,
  useSecretSanta,
  useUser,
} from '@/hooks/data';
import { useEventActions } from '@/hooks/event-actions';

export const Route = createFileRoute('/_app/events/$id/')({
  head: () => ({ meta: [{ title: 'Event · Family Gifts' }] }),
  component: Event,
});

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (e) {
    showError('Couldn’t update event', e);
  }
}

const MAX_AVATARS = 4;

// Ported from apps/mobile/src/screens/event.tsx.
function Event() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();

  const event = useEvent(id);
  const eventId = event?._id;
  const user = useUser();
  const attendees = useEventAttendees(eventId);
  const me = attendees?.find(a => a.userId === user?._id);
  const myRole = me?.role;
  const isOwner = myRole === 'owner';
  const isHost = isOwner || myRole === 'host';
  const pendingCount = useEventPendingInviteCount(eventId);
  const invitees = useEventInvitees(eventId);
  const occasionLists = useEventOccasionLists(eventId);
  const inviteLink = useEventInviteLink(eventId);
  const secretSanta = useSecretSanta(eventId);

  const setAttendeeRole = useMutation(api.events.setAttendeeRole);
  const removeAttendee = useMutation(api.events.removeAttendee);
  const revokeInvite = useMutation(api.events.revokeInvite);
  const transferOwnership = useMutation(api.events.transferOwnership);
  const setMyStatus = useMutation(api.events.setMyStatus);
  const undoDraw = useMutation(api.secretSanta.undoDraw);
  const setSecretSantaOff = useMutation(api.secretSanta.setOff);
  const eventActions = useEventActions(event, () => navigate({ to: '/events', replace: true }));
  const cancelled = event?.cancelledAt !== undefined;
  // Who the Ask for ideas dialog is open for, if anyone.
  const [askingUserId, setAskingUserId] = useState<string | null>(null);

  if (event === null) return <NotFound message="This event doesn’t exist or you’re not attending it." />;

  async function confirmRemove(attendeeId: Id<'eventAttendees'>, name: string) {
    if (!event) return;
    const ok = await confirm({
      title: 'Remove attendee?',
      message: `${name} will be removed from ${event.name}.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) void run(() => removeAttendee({ eventId: event._id, attendeeId }));
  }

  async function confirmRevoke(inviteId: Id<'eventAttendees'>, name: string) {
    const ok = await confirm({
      title: 'Revoke invite?',
      message: `The invite sent to ${name} will stop working. You can invite them again later.`,
      confirmText: 'Revoke',
      destructive: true,
    });
    if (ok) void run(() => revokeInvite({ id: inviteId }));
  }

  async function confirmTransfer(attendeeId: Id<'eventAttendees'>, name: string) {
    if (!event) return;
    const ok = await confirm({
      title: `Make ${name} the owner?`,
      message: 'You’ll become a host. Only the owner can delete the event.',
      confirmText: 'Transfer',
    });
    if (ok) void run(() => transferOwnership({ eventId: event._id, attendeeId }));
  }

  async function confirmUndoDraw() {
    if (!event || !secretSanta?.exists) return;
    // Before the names are sent nobody knew their match, so nobody is told.
    const sent = secretSanta.status === 'sent';
    const ok = await confirm({
      title: 'Undo the draw?',
      message: `Everyone’s match is cleared. Who’s in and the keep-apart rules are kept, so you can draw again.${
        sent ? ' Everyone in the draw gets a notice that their old match no longer counts.' : ''
      }`,
      confirmText: 'Undo draw',
      destructive: true,
    });
    if (ok) void run(() => undoDraw({ eventId: event._id }));
  }

  // Secret Santa off. Before anything's set up there's nothing to lose, so
  // it's immediate; a draft setup is thrown away, so ask first.
  async function turnOffSecretSanta() {
    if (!event || !secretSanta) return;
    if (secretSanta.exists) {
      const ok = await confirm({
        title: 'Turn off Secret Santa?',
        message:
          'Who’s in, the keep-apart rules and the budget will be cleared. You can turn it back on by editing the event.',
        confirmText: 'Turn off',
        destructive: true,
      });
      if (!ok) return;
    }
    void run(() => setSecretSantaOff({ eventId: event._id, off: true }));
  }

  async function confirmCantGo() {
    if (!event) return;
    const ok = await confirm({
      title: 'Can’t go anymore?',
      message: 'The hosts will see you can’t make it. You can still see the event and change your mind.',
      confirmText: 'Can’t go',
      destructive: true,
    });
    if (ok) void run(() => setMyStatus({ eventId: event._id, status: 'declined' }));
  }

  const going = attendees?.filter(a => a.status === 'going') ?? [];

  // Everyone's lists for this event, keyed by owner, so each attendee row can show theirs.
  const listsByOwner = new Map<string, NonNullable<typeof occasionLists>>();
  for (const list of occasionLists ?? []) {
    listsByOwner.set(list.ownerId, [...(listsByOwner.get(list.ownerId) ?? []), list]);
  }
  // Going, by name, then you, then anyone who can't go.
  const rank = (a: NonNullable<typeof attendees>[number]) =>
    a.userId === user?._id ? 1 : a.status === 'declined' ? 2 : 0;
  const sortedAttendees = [...(attendees ?? [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  const summary = secretSanta?.exists ? secretSantaSummary(secretSanta) : null;

  return (
    <Page>
      <PageHeader
        title={event?.name ?? ''}
        fallback="/events"
        subtitle={
          event && (
            <>
              {event.date ? formatShortDate(event.date, event.startTime) : formatWhen(event)}
              {event.location && <> · {event.location}</>}
            </>
          )
        }
        actions={
          <>
            {isHost && (
              <Button asChild variant="ghost" size="icon" className="glass">
                <Link to="/events/$id/edit" params={{ id }} aria-label="Edit event" title="Edit event">
                  <Pencil className="size-[17px]" />
                </Link>
              </Button>
            )}
            <ActionsMenu
              label="Event options"
              actions={[
                // Invites are host-only on the server.
                isHost &&
                  !cancelled && {
                    label: 'Invite guests',
                    onSelect: () => navigate({ to: '/events/$id/invite', params: { id } }),
                  },
                // Guests only see this while hosts let them share the link.
                !!inviteLink?.url &&
                  !cancelled && { label: 'Copy invite link', onSelect: () => void copyLink(inviteLink.url!) },
                me?.status === 'declined'
                  ? {
                      label: 'I can go after all',
                      onSelect: () => event && void run(() => setMyStatus({ eventId: event._id, status: 'going' })),
                    }
                  : me && { label: 'Can’t go anymore', onSelect: () => void confirmCantGo(), destructive: true },
                event?.archived
                  ? { label: 'Unarchive', onSelect: eventActions.unarchive }
                  : { label: 'Archive', onSelect: eventActions.archive },
                isHost &&
                  (cancelled
                    ? { label: 'Restore event', onSelect: eventActions.restore }
                    : { label: 'Cancel event', onSelect: () => void eventActions.confirmCancel(), destructive: true }),
                isOwner && {
                  label: 'Delete event',
                  onSelect: () => void eventActions.confirmDelete(),
                  destructive: true,
                },
              ]}
            />
          </>
        }
      />

      {cancelled && (
        <div className="flex items-center gap-3 rounded-xl bg-fill p-3">
          <p className="flex-1 text-ink-muted">
            This event was cancelled. Its invites and link don’t work until a host restores it.
          </p>
          {isHost && (
            <Button variant="secondary" size="sm" className="text-accent" onClick={eventActions.restore}>
              Restore
            </Button>
          )}
        </div>
      )}

      {event?.description && <p className="whitespace-pre-line">{event.description}</p>}

      {me?.status === 'going' && attendees && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-success">
              <Check className="size-3.5 text-on-success" strokeWidth={3} />
            </span>
            <span>
              You’re going
              {isHost && <> · You’re hosting</>}
            </span>
          </div>
          <div className="border-b border-line" />
          <div className="flex items-center gap-3">
            <AvatarStack people={going.slice(0, MAX_AVATARS)} />
            <span className="flex-1 text-[13px] text-ink-muted">
              {going.length} going · {pendingCount ?? 0} waiting
            </span>
            {isHost && !cancelled && (
              <Button asChild variant="secondary" size="sm">
                <Link to="/events/$id/invite" params={{ id }}>
                  <Plus className="text-accent" strokeWidth={2.5} />
                  <span className="text-accent">Invite</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {secretSanta && (secretSanta.exists || isHost) && !event?.secretSantaOff && (
        <Section title="Secret Santa">
          {!secretSanta.exists || (isHost && secretSanta.status === 'draft') ? (
            // Until names are drawn, hosts can open the setup to change it (or
            // draw again after an undo), or turn Secret Santa off; after that
            // the row shows how it's going.
            <div className="flex items-center gap-2 border-b border-line pb-1">
              <Link to="/events/$id/secret-santa/setup" params={{ id }} className="flex flex-1 items-center gap-2">
                <span className="flex-1">
                  <span className="block text-[17px]">{summary ? summary.title : 'Draw names'}</span>
                  <span className="block text-[13px] text-ink-muted">{summary ? summary.detail : 'Not set up'}</span>
                </span>
                <ChevronRight className="size-5 text-ink-muted" />
              </Link>
              {isHost && (
                <ActionsMenu
                  label="Secret Santa options"
                  actions={[
                    { label: 'Turn off Secret Santa', onSelect: () => void turnOffSecretSanta(), destructive: true },
                  ]}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-line pb-1">
              {(secretSanta.status === 'sent' && secretSanta.myAssignment) ||
              (secretSanta.isManager && secretSanta.mode === 'reviewed') ? (
                // Once names are sent, anyone in the draw opens the Secret
                // Santa page to reveal their Match. In a Reviewed draw, hosts
                // open it to see every Match (and send the names).
                <Link to="/events/$id/secret-santa" params={{ id }} className="flex flex-1 items-center gap-2">
                  <span className="flex-1">
                    <span className="block text-[17px]">{summary?.title}</span>
                    <span className="block text-[13px] text-ink-muted">{summary?.detail}</span>
                  </span>
                  <ChevronRight className="size-5 text-ink-muted" />
                </Link>
              ) : (
                <div className="flex-1">
                  <p className="text-[17px]">{summary?.title}</p>
                  <p className="text-[13px] text-ink-muted">{summary?.detail}</p>
                </div>
              )}
              {isHost && secretSanta.status !== 'draft' && (
                <ActionsMenu
                  label="Secret Santa options"
                  actions={[{ label: 'Undo draw', onSelect: () => void confirmUndoDraw(), destructive: true }]}
                />
              )}
            </div>
          )}
        </Section>
      )}

      {attendees && attendees.length > 0 && (
        <Section title={`Attendees · ${attendees.length}`} className="gap-3">
          {sortedAttendees.map(attendee => {
            const isSelf = attendee.userId === user?._id;
            const canManageThem = isHost && !isSelf && attendee.role !== 'owner';
            const [firstList, ...moreLists] = listsByOwner.get(attendee.userId ?? '') ?? [];
            // Role only when it's not the usual guest, then their list.
            const prefix = [
              attendee.role !== 'guest' && capitalize(attendee.role),
              attendee.status === 'declined' && 'Can’t go',
            ].filter(Boolean);
            const subtitle = [...prefix, firstList ? firstList.title : !isSelf && 'No list yet']
              .filter(Boolean)
              .join(' · ');
            const who = (
              <>
                <Avatar person={attendee} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block">
                    {attendee.name}
                    {isSelf && <span className="text-ink-muted"> (you)</span>}
                  </span>
                  {subtitle !== '' && <span className="block text-subhead text-ink-muted">{subtitle}</span>}
                </span>
              </>
            );
            return (
              <div key={attendee.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {firstList ? (
                    <Link
                      to="/lists/$id"
                      params={{ id: firstList._id }}
                      className="flex min-w-0 flex-1 items-center gap-2"
                    >
                      {who}
                      <span className="text-subhead text-ink-muted">{listSummary(firstList, isSelf)}</span>
                      <ChevronRight className="size-5 text-ink-muted" />
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {who}
                      {isSelf
                        ? !cancelled && (
                            <Button asChild variant="secondary" size="sm">
                              <Link to="/lists/new" search={{ eventId: id }}>
                                <Plus className="text-accent" strokeWidth={2.5} />
                                <span className="text-accent">Make a list</span>
                              </Link>
                            </Button>
                          )
                        : !cancelled &&
                          attendee.userId && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setAskingUserId(attendee.userId ?? null)}
                            >
                              <MessageCircle className="text-accent" strokeWidth={2.5} />
                              <span className="text-accent">Ask for ideas</span>
                            </Button>
                          )}
                    </div>
                  )}
                  {canManageThem && event && (
                    <ActionsMenu
                      label={`Options for ${attendee.name}`}
                      actions={[
                        attendee.role === 'host'
                          ? {
                              label: 'Make guest',
                              onSelect: () =>
                                void run(() =>
                                  setAttendeeRole({ eventId: event._id, attendeeId: attendee.id, role: 'guest' }),
                                ),
                            }
                          : {
                              label: 'Make host',
                              onSelect: () =>
                                void run(() =>
                                  setAttendeeRole({ eventId: event._id, attendeeId: attendee.id, role: 'host' }),
                                ),
                            },
                        isOwner &&
                          attendee.role === 'host' && {
                            label: 'Make owner',
                            onSelect: () => void confirmTransfer(attendee.id, attendee.name),
                          },
                        {
                          label: 'Remove from event',
                          onSelect: () => void confirmRemove(attendee.id, attendee.name),
                          destructive: true,
                        },
                      ]}
                    />
                  )}
                </div>
                {/* Any further lists they have for this event, tucked under their row. */}
                {moreLists.map(list => (
                  <Link
                    key={list._id}
                    to="/lists/$id"
                    params={{ id: list._id }}
                    className="ml-12 flex items-center gap-2"
                  >
                    <span className="flex-1 text-subhead text-ink-muted">{list.title}</span>
                    <span className="text-subhead text-ink-muted">{listSummary(list, isSelf)}</span>
                    <ChevronRight className="size-5 text-ink-muted" />
                  </Link>
                ))}
              </div>
            );
          })}
        </Section>
      )}

      {invitees && invitees.invitees.length + invitees.withoutAccount > 0 && (
        <Section title={`Waiting on ${invitees.invitees.length + invitees.withoutAccount}`} className="gap-3">
          {invitees.invitees.map(invitee => {
            const label = invitee.name ?? invitee.email ?? '';
            // Hosts see where the invite came from: the group, or else the email it went to.
            const details = invitee.fromGroupName
              ? `From ${invitee.fromGroupName}`
              : invitee.name
                ? (invitee.email ?? '')
                : '';
            return (
              <div key={invitee.id} className="flex items-center gap-2">
                <Avatar person={{ name: label, color: invitee.color }} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label}</span>
                  {details !== '' && <span className="block truncate text-subhead text-ink-muted">{details}</span>}
                </span>
                {isHost && (
                  <ActionsMenu
                    label={`Options for ${label}`}
                    actions={[
                      {
                        label: 'Revoke invite',
                        onSelect: () => void confirmRevoke(invitee.id, label),
                        destructive: true,
                      },
                    ]}
                  />
                )}
              </div>
            );
          })}
          {invitees.withoutAccount > 0 && (
            <p className="text-ink-muted">
              {invitees.withoutAccount} {invitees.withoutAccount === 1 ? 'person' : 'people'} without an account
            </p>
          )}
        </Section>
      )}

      {askingUserId && (
        <AskForIdeasDialog open onClose={() => setAskingUserId(null)} userId={askingUserId} eventId={eventId} />
      )}
    </Page>
  );
}

// Your own list counts ideas; claims stay hidden from the owner, so others' lists show how much is taken.
function listSummary(list: { itemCount: number; claimedItemCount: number | null }, isMine: boolean) {
  if (isMine) return plural(list.itemCount, 'idea');
  const claimed = list.claimedItemCount ?? 0;
  return claimed === 0 ? `${list.itemCount} open` : `${claimed} of ${list.itemCount} taken`;
}

type SecretSantaState = Extract<NonNullable<ReturnType<typeof useSecretSanta>>, { exists: true }>;

// The Secret Santa row once it's set up: whether names are drawn (the Match
// itself only shows on the Secret Santa page), or when they will be.
function secretSantaSummary(state: SecretSantaState) {
  const budget = state.budget != null ? `$${state.budget} limit` : null;
  const withBudget = (text: string) => (budget ? `${text} · ${budget}` : text);

  const reviewedHost = state.isManager && state.mode === 'reviewed';
  if (state.status === 'drawn') return { title: 'Names drawn', detail: withBudget('Not sent yet') };
  if (state.status === 'sent') {
    if (state.myAssignment) return { title: 'Names drawn', detail: withBudget('Click to see who you’re giving to') };
    if (reviewedHost) return { title: 'Names sent', detail: withBudget('Click to see the matches') };
    return { title: 'Names drawn', detail: withBudget('You’re not in the draw') };
  }
  if (state.undone) {
    return state.isManager
      ? { title: 'Draw undone', detail: withBudget('Click to draw names again') }
      : { title: 'Names being drawn again', detail: withBudget('Your old match no longer counts') };
  }
  const drawError = state.isManager ? state.drawError : null;
  if (drawError) return { title: 'Names not drawn yet', detail: drawError };
  const notified = reviewedHost ? 'Nobody is told until you send the names' : 'Everyone gets a notification';
  if (state.drawAt)
    return { title: `Drawing names ${format(state.drawAt, 'EEE, MMM d')}`, detail: withBudget(notified) };
  // Nothing scheduled: e.g. a Reviewed draw undone before it was sent.
  if (state.isManager) return { title: 'Names not drawn yet', detail: withBudget('Click to draw names') };
  return { title: 'Drawing names soon', detail: withBudget('Everyone gets a notification') };
}
