import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { ChevronRight, Pencil, UserPlus } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { capitalize, plural } from '@shared/utils';
import { confirm, showError } from '@/components/alerts';
import { Avatar } from '@/components/avatar';
import { copyLink, shareLink } from '@/components/guest-picker';
import { ActionsMenu, FieldRow, Footnote, NotFound, Page, PageHeader, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { useGroup, useGroupEvents, useGroupInviteLink, useGroupInvites, useGroupMembers } from '@/hooks/data';

export const Route = createFileRoute('/_app/groups/$id/')({
  head: () => ({ meta: [{ title: 'Group · Family Gifts' }] }),
  component: Group,
});

// Event dates are "YYYY-MM-DD"; parsed as local dates so they don't shift a day.
function formatEventDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const eventStatusLabel = {
  attending: 'Attending',
  invited: 'Invited',
  declined: 'Declined',
  notInvited: 'Not invited',
} as const;

const fail = (e: unknown) => showError('Couldn’t update group', e);

// A group's members, events and invite settings. Ported from
// apps/mobile/src/screens/group.tsx.
function Group() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const group = useGroup(id);
  const members = useGroupMembers(id);
  const invites = useGroupInvites(id);
  const inviteLink = useGroupInviteLink(id);
  const events = useGroupEvents(id);

  const isManager = inviteLink?.canManage ?? false;
  const membersCanInvite = inviteLink?.membersCanInvite ?? false;
  const canInvite = isManager || membersCanInvite;

  const setMemberRole = useMutation(api.groups.setMemberRole);
  const removeMember = useMutation(api.groups.removeMember);
  const setMembersCanInviteMutation = useMutation(api.groups.setMembersCanInvite);
  const resetInviteLink = useMutation(api.groups.resetInviteLink);
  const revokeInvite = useMutation(api.groups.revokeInvite);
  const leaveGroup = useMutation(api.groups.leave);
  const deleteGroup = useMutation(api.groups.remove);

  if (group === null) return <NotFound message="This group doesn’t exist, or you’re not in it." />;

  // A manager can only leave if someone else can still manage the group (the
  // server enforces this too).
  const hasOtherManager = members?.some(m => !m.isSelf && (m.role === 'manager' || m.role === 'owner')) ?? false;
  const canLeave = !isManager || hasOtherManager;
  const groupId = group?._id;

  // Leaving or deleting empties this page's queries, so head to People.
  const exitGroup = () => navigate({ to: '/people', replace: true });

  async function confirmLeave() {
    if (!group) return;
    const ok = await confirm({
      title: `Leave ${group.name}?`,
      message: 'Your lists will no longer be shared with this group.',
      confirmText: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    try {
      await leaveGroup({ groupId: group._id });
      exitGroup();
    } catch (e) {
      fail(e);
    }
  }

  async function confirmDelete() {
    if (!group) return;
    const ok = await confirm({
      title: `Delete ${group.name}?`,
      message: 'This removes the group for everyone, along with its members and pending invites. This can’t be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteGroup({ id: group._id });
      exitGroup();
    } catch (e) {
      fail(e);
    }
  }

  async function confirmRemove(memberId: Id<'groupMembers'>, name: string) {
    if (!group) return;
    const ok = await confirm({
      title: 'Remove member?',
      message: `${name} will be removed from ${group.name}.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) removeMember({ groupId: group._id, memberId }).catch(fail);
  }

  function changeRole(memberId: Id<'groupMembers'>, role: 'manager' | 'member') {
    if (groupId) setMemberRole({ groupId, memberId, role }).catch(fail);
  }

  async function confirmResetInviteLink() {
    if (!groupId) return;
    const ok = await confirm({
      title: 'Reset invite link?',
      message: 'The current link will stop working. Everyone already in the group stays.',
      confirmText: 'Reset',
      destructive: true,
    });
    if (ok) resetInviteLink({ groupId }).catch(fail);
  }

  return (
    <Page>
      <PageHeader
        title={group?.name ?? ''}
        fallback="/people"
        subtitle={members && members.length > 0 ? plural(members.length, 'member') : undefined}
        actions={
          <>
            {canInvite && (
              <Button asChild variant="ghost" size="icon" className="glass">
                <Link to="/groups/$id/invite" params={{ id }} aria-label="Invite members" title="Invite members">
                  <UserPlus className="size-[18px]" />
                </Link>
              </Button>
            )}
            {isManager && (
              <Button asChild variant="ghost" size="icon" className="glass">
                <Link to="/groups/$id/edit" params={{ id }} aria-label="Edit group" title="Edit group">
                  <Pencil className="size-[18px]" />
                </Link>
              </Button>
            )}
          </>
        }
      />

      {members && members.length > 0 && (
        <Section title="Members">
          {members.map(member => {
            const ideas =
              member.itemCount === 0
                ? 'No ideas shared'
                : member.isSelf || member.claimedCount === null
                  ? plural(member.itemCount, 'idea')
                  : `${plural(member.itemCount, 'idea')} · ${member.claimedCount} claimed`;
            const memberIsManager = member.role === 'manager';
            return (
              <div key={member.id} className="flex items-center gap-3">
                <Link to="/people/$id" params={{ id: member.userId }} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar person={member} size={40} />
                  <span className="min-w-0 flex-1 border-b border-line py-1">
                    <span className="block">
                      {member.name}
                      {member.isSelf && <span className="text-ink-muted"> (you)</span>}
                    </span>
                    <span className="block text-subhead text-ink-muted">
                      {capitalize(member.role)} · {ideas}
                    </span>
                  </span>
                </Link>
                {isManager && !member.isSelf && member.role !== 'owner' && (
                  <ActionsMenu
                    label={`Options for ${member.name}`}
                    actions={[
                      memberIsManager
                        ? { label: 'Demote to member', onSelect: () => changeRole(member.id, 'member') }
                        : { label: 'Promote to manager', onSelect: () => changeRole(member.id, 'manager') },
                      { label: 'Remove from group', onSelect: () => void confirmRemove(member.id, member.name), destructive: true },
                    ]}
                  />
                )}
              </div>
            );
          })}
          {canInvite && (
            <Link to="/groups/$id/invite" params={{ id }} className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-fill">
                <UserPlus className="size-5 text-accent" />
              </span>
              <span className="flex-1 text-accent">Invite people</span>
            </Link>
          )}
          <Footnote>
            Managers can add or remove people and change these settings. They can’t see claims on anyone’s list, or lists
            that aren’t shared with the group.
          </Footnote>
        </Section>
      )}

      {invites && invites.length > 0 && (
        <Section title={`Pending invites · ${invites.length}`}>
          {invites.map(invite => (
            <FieldRow key={invite._id}>
              <span className="min-w-0 flex-1 truncate">{invite.email}</span>
              <Button
                variant="link"
                className="text-destructive"
                onClick={() => revokeInvite({ id: invite._id }).catch(fail)}
              >
                Revoke
              </Button>
            </FieldRow>
          ))}
        </Section>
      )}

      {events && events.length > 0 && (
        <Section title="Events">
          {events.map(event => (
            <Link key={event.id} to="/events/$id" params={{ id: event.id }}>
              <FieldRow>
                <span className="flex-1">
                  <span className="block">{event.name}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {event.date
                      ? `${formatEventDate(event.date)}${event.endDate ? ` – ${formatEventDate(event.endDate)}` : ''} · `
                      : ''}
                    {eventStatusLabel[event.status]}
                  </span>
                </span>
                <ChevronRight className="size-5" />
              </FieldRow>
            </Link>
          ))}
        </Section>
      )}

      {inviteLink && (
        <Section title="Joining">
          {(inviteLink.url || isManager) && (
            <FieldRow>
              <span>
                <span className="block">Invite Link</span>
                <span className="block text-[13px] text-ink-muted">Anyone with the link joins right away</span>
              </span>
              {inviteLink.url ? (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => void copyLink(inviteLink.url!)}>
                    Copy
                  </Button>
                  <Button variant="secondary" onClick={() => void shareLink(inviteLink.url!)}>
                    Share
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => groupId && resetInviteLink({ groupId }).catch(fail)}>
                  Create
                </Button>
              )}
            </FieldRow>
          )}
          {isManager && (
            <>
              <label className="cursor-pointer">
                <FieldRow>
                  <span>Members can invite</span>
                  <Switch
                    aria-label="Members can invite"
                    checked={membersCanInvite}
                    onCheckedChange={value =>
                      groupId && setMembersCanInviteMutation({ groupId, membersCanInvite: value }).catch(fail)
                    }
                  />
                </FieldRow>
              </label>
              {inviteLink.url && (
                <FieldRow>
                  <Button variant="link" onClick={confirmResetInviteLink}>
                    Reset invite link
                  </Button>
                </FieldRow>
              )}
            </>
          )}
          <Footnote>
            {!isManager
              ? membersCanInvite
                ? 'Anyone in the group can share the link.'
                : 'Only managers can share the invite link.'
              : membersCanInvite
                ? 'Anyone in the group can share the link. Resetting it stops the old link from working. Everyone already here stays.'
                : 'Only managers can share the link. Resetting it stops the old link from working. Everyone already here stays.'}
          </Footnote>
        </Section>
      )}

      {group && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="lg" onClick={confirmLeave} disabled={!canLeave}>
              Leave group
            </Button>
            {!canLeave && <Footnote>You’re the only manager. Make someone else a manager before you leave.</Footnote>}
          </div>
          {isManager && (
            <Button variant="destructive" size="lg" onClick={confirmDelete}>
              Delete group
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}
