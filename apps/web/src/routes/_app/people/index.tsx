import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, Plus, Users } from 'lucide-react';

import type { Doc } from '@convex/_generated/dataModel';
import { formatRelativeDay } from '@shared/event-dates';
import { plural } from '@shared/utils';
import { Avatar } from '@/components/avatar';
import { GroupInvitationListItem } from '@/components/home';
import { EmptyState, Page, Section, TabHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useGroupMembers, useGroups, useMyGroupInvites } from '@/hooks/data';

export const Route = createFileRoute('/_app/people/')({
  head: () => ({ meta: [{ title: 'People · Family Gifts' }] }),
  component: People,
});

// Your groups and everyone in them.
function People() {
  const groups = useGroups();
  const invites = useMyGroupInvites();
  return (
    <Page className="gap-6">
      <TabHeader
        title="People"
        action={
          <Button asChild variant="ghost" size="icon" className="glass">
            <Link to="/groups/new" aria-label="Add group" title="Add group">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      {!!invites?.length && (
        <Section title={`Invitations · ${invites.length}`}>
          {invites.map(invite => (
            <GroupInvitationListItem key={invite._id} invite={invite} />
          ))}
        </Section>
      )}
      {groups && groups.length === 0 && !invites?.length ? (
        <EmptyState
          icon={Users}
          title="Gifts are better together"
          body="Make a group for your family or friends and invite them. Everyone shares lists and claims gifts without spoiling the surprise."
        >
          <Button asChild size="lg" className="mt-4 w-full max-w-xs">
            <Link to="/groups/new">Create a group</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {groups?.map(group => (
            <GroupMembers key={group._id} group={group} />
          ))}
        </div>
      )}
    </Page>
  );
}

function GroupMembers({ group }: { group: Doc<'groups'> }) {
  const members = useGroupMembers(group._id);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-muted">{group.name}</h2>
        <Link
          to="/groups/$id"
          params={{ id: group._id }}
          className="flex items-center gap-1 text-accent hover:underline"
        >
          {plural(members?.length ?? 0, 'member')}
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {members?.map(member => {
          const ideas =
            member.itemCount === 0
              ? 'No ideas shared'
              : member.claimedCount === null
                ? plural(member.itemCount, 'idea')
                : `${plural(member.itemCount, 'idea')} · ${member.claimedCount} claimed`;
          return (
            <Link key={member.id} to="/people/$id" params={{ id: member.userId }} className="flex items-center gap-3">
              <Avatar person={member} size={40} />
              <span className="flex-1 border-b border-line py-1">
                <span className="block">
                  {member.name}
                  {member.isSelf && <span className="text-ink-muted"> (you)</span>}
                </span>
                <span className="block text-sm text-ink-muted">{ideas}</span>
                {member.nextOccasion && (
                  <span className="block text-sm text-accent">
                    {member.nextOccasion.label} · {formatRelativeDay(member.nextOccasion.date)}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
