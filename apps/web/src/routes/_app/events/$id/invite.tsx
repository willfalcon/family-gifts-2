import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { confirm, showAlert, showError } from '@/components/alerts';
import { GuestPicker, useGuests, useShareEventLink } from '@/components/guest-picker';
import { FieldRow, Footnote, NotFound, Section, SheetPage, useGoBack } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/controls';
import { useEvent, useEventInviteLink, useEventInvites, useGroups } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

export const Route = createFileRoute('/_app/events/$id/invite')({
  head: () => ({ meta: [{ title: 'Invite Guests · Family Gifts' }] }),
  component: InviteGuests,
});

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (e) {
    showError('Couldn’t update event', e);
  }
}

// Invites more people to an existing event, from its page. Picks are sent on
// Send. Also holds the invite link settings and the unanswered invites. Hosts
// only. Ported from apps/mobile/src/screens/invite-guests.tsx.
function InviteGuests() {
  const { id } = Route.useParams();
  const goBack = useGoBack();
  const event = useEvent(id);
  const eventId = event?._id;
  const inviteLink = useEventInviteLink(eventId);
  const invites = useEventInvites(eventId, !!inviteLink?.canManage);
  const groups = useGroups();
  const shareLink = useShareEventLink();

  const inviteByEmail = useMutation(api.events.invite);
  const inviteUser = useMutation(api.events.inviteUser);
  const inviteGroup = useMutation(api.events.inviteGroup);
  const revokeInvite = useMutation(api.events.revokeInvite);
  const setGuestsCanInvite = useMutation(api.events.setGuestsCanInvite);
  const resetInviteLink = useMutation(api.events.resetInviteLink);

  const { guests, addGuest, removeGuest } = useGuests();
  const [groupIds, setGroupIds] = useState<Id<'groups'>[]>([]);
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);
  const pickCount = guests.length + groupIds.length;

  if (event === null) return <NotFound message="This event doesn’t exist or you’re not attending it." />;

  async function confirmRevoke(inviteId: Id<'eventAttendees'>, email: string) {
    const ok = await confirm({
      title: 'Revoke invite?',
      message: `The invite sent to ${email} will stop working. You can invite them again later.`,
      confirmText: 'Revoke',
      destructive: true,
    });
    if (ok) void run(() => revokeInvite({ id: inviteId }));
  }

  async function shareInviteLink() {
    if (!eventId) return;
    setSharing(true);
    try {
      await shareLink(eventId);
    } finally {
      setSharing(false);
    }
  }

  async function send() {
    if (!eventId || pickCount === 0) {
      goBack();
      return;
    }
    setSending(true);
    // Each invite stands alone, so one failing (e.g. already invited) doesn't stop the rest.
    const results = await Promise.allSettled([
      ...groupIds.map(groupId => inviteGroup({ eventId, groupId })),
      ...guests.map(guest =>
        guest.kind === 'user' ? inviteUser({ eventId, userId: guest.userId }) : inviteByEmail({ eventId, email: guest.email }),
      ),
    ]);
    setSending(false);
    const failures = results.filter(r => r.status === 'rejected');
    goBack();
    if (failures.length > 0) {
      const messages = [...new Set(failures.map(f => errorMessage(f.reason)))];
      void showAlert(failures.length === results.length ? 'Invites didn’t send' : 'Some invites didn’t send', messages.join('\n'));
    }
  }

  async function confirmResetLink() {
    if (!eventId) return;
    const ok = await confirm({
      title: 'Reset invite link?',
      message: 'The current link will stop working. Everyone already on the event stays.',
      confirmText: 'Reset',
      destructive: true,
    });
    if (ok) void run(() => resetInviteLink({ eventId }));
  }

  function toggleGroup(groupId: Id<'groups'>) {
    setGroupIds(ids => (ids.includes(groupId) ? ids.filter(g => g !== groupId) : [...ids, groupId]));
  }

  return (
    <SheetPage
      title="Invite Guests"
      cancelIcon="none"
      action={{ label: pickCount > 0 ? 'Send' : 'Done', onClick: send, disabled: sending }}
    >
      <GuestPicker
        target={{ kind: 'event', eventId }}
        guests={guests}
        addGuest={addGuest}
        removeGuest={removeGuest}
        onShareLink={shareInviteLink}
        sharing={sharing}
      >
        {groups && groups.length > 0 && (
          <Section title="Groups" className="gap-0">
            {groups.map(group => (
              <label key={group._id} className="flex cursor-pointer items-center gap-3 border-b border-line py-2">
                <span className="flex-1">
                  <span className="block">{group.name}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
                  </span>
                </span>
                <Checkbox
                  checked={groupIds.includes(group._id)}
                  onCheckedChange={() => toggleGroup(group._id)}
                  aria-label={`Invite everyone in ${group.name}`}
                />
              </label>
            ))}
          </Section>
        )}

        {invites && invites.length > 0 && (
          <Section title={`Waiting to hear back · ${invites.length}`}>
            {invites.map(invite => (
              <FieldRow key={invite._id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{invite.email}</span>
                  {invite.sourceGroupName && <span className="block text-[13px] text-ink-muted">From {invite.sourceGroupName}</span>}
                </span>
                <Button variant="link" className="text-destructive" onClick={() => void confirmRevoke(invite._id, invite.email ?? '')}>
                  Revoke
                </Button>
              </FieldRow>
            ))}
          </Section>
        )}

        {inviteLink?.canManage && eventId && (
          <Section title="Invite link">
            <label className="cursor-pointer">
              <FieldRow>
                <span>Guests can share the link</span>
                <Switch
                  aria-label="Guests can share the link"
                  checked={inviteLink.guestsCanInvite}
                  onCheckedChange={value => void run(() => setGuestsCanInvite({ eventId, guestsCanInvite: value }))}
                />
              </FieldRow>
            </label>
            {inviteLink.url && (
              <FieldRow>
                <Button variant="link" onClick={() => void confirmResetLink()}>
                  Reset invite link
                </Button>
              </FieldRow>
            )}
            <Footnote>
              {inviteLink.guestsCanInvite ? 'Anyone on the event can share the link.' : 'Only hosts can share the link.'} Resetting it
              stops the old link from working.
            </Footnote>
          </Section>
        )}
      </GuestPicker>
    </SheetPage>
  );
}
