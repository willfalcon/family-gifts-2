import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { confirm, showAlert, showError } from '@/components/alerts';
import { GuestPicker, shareLink, useGuests } from '@/components/guest-picker';
import { FieldRow, NotFound, Section, SheetPage, useGoBack } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useGroup, useGroupInviteLink, useGroupInvites } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

export const Route = createFileRoute('/_app/groups/$id/invite')({
  head: () => ({ meta: [{ title: 'Invite Members · Family Gifts' }] }),
  component: InviteMembers,
});

// Invite people to a group: pick people the viewer already knows, or add an
// email. Picks are sent on Send. Managers also see unanswered invites here and
// can revoke them. Ported from apps/mobile/src/screens/invite-members.tsx.
function InviteMembers() {
  const { id } = Route.useParams();
  const goBack = useGoBack();
  const group = useGroup(id);
  const groupId = group?._id;
  const inviteLink = useGroupInviteLink(id);
  const invites = useGroupInvites(id);

  const inviteByEmail = useMutation(api.groups.invite);
  const inviteUser = useMutation(api.groups.inviteUser);
  const revokeInvite = useMutation(api.groups.revokeInvite);
  const resetInviteLink = useMutation(api.groups.resetInviteLink);

  const { guests, addGuest, removeGuest } = useGuests();
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);

  if (group === null) return <NotFound message="This group doesn’t exist, or you’re not in it." />;

  // Members can share an existing link; only managers can create one for
  // older groups that don't have one yet.
  const canShareLink = !!inviteLink && (!!inviteLink.url || inviteLink.canManage);

  async function shareInviteLink() {
    if (!groupId || !inviteLink) return;
    setSharing(true);
    try {
      let url = inviteLink.url;
      if (!url) {
        const ok = await confirm({ title: 'Create an invite link?', message: 'Anyone with the link can join the group.', confirmText: 'Create' });
        if (!ok) return;
        url = await resetInviteLink({ groupId });
      }
      await shareLink(url);
    } catch (e) {
      showError('Couldn’t share the link', e);
    } finally {
      setSharing(false);
    }
  }

  async function send() {
    if (!groupId || guests.length === 0) {
      goBack();
      return;
    }
    setSending(true);
    // Each invite stands alone, so one failing (e.g. already a member) doesn't stop the rest.
    const results = await Promise.allSettled(
      guests.map(guest =>
        guest.kind === 'user' ? inviteUser({ groupId, userId: guest.userId }) : inviteByEmail({ groupId, email: guest.email }),
      ),
    );
    setSending(false);
    const failures = results.filter(r => r.status === 'rejected');
    goBack();
    if (failures.length > 0) {
      const messages = [...new Set(failures.map(f => errorMessage(f.reason)))];
      void showAlert(failures.length === results.length ? 'Invites didn’t send' : 'Some invites didn’t send', messages.join('\n'));
    }
  }

  return (
    <SheetPage
      title="Invite Members"
      cancelIcon="none"
      action={{ label: guests.length > 0 ? 'Send' : 'Done', onClick: send, disabled: sending }}
    >
      <GuestPicker
        target={{ kind: 'group', groupId }}
        guests={guests}
        addGuest={addGuest}
        removeGuest={removeGuest}
        onShareLink={canShareLink ? shareInviteLink : undefined}
        sharing={sharing}
      >
        {invites && invites.length > 0 && (
          <Section title={`Waiting to hear back · ${invites.length}`}>
            {invites.map(invite => (
              <FieldRow key={invite._id}>
                <span className="min-w-0 flex-1 truncate">{invite.email}</span>
                <Button
                  variant="link"
                  className="text-destructive"
                  onClick={() => revokeInvite({ id: invite._id as Id<'groupInvites'> }).catch(e => showError('Couldn’t update group', e))}
                >
                  Revoke
                </Button>
              </FieldRow>
            ))}
          </Section>
        )}
      </GuestPicker>
    </SheetPage>
  );
}
