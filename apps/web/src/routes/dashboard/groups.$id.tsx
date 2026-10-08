import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Pencil, Gift } from 'lucide-react';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { bigTitleClasses } from '@/components/ui/big-title';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Heading from '@/components/ui/heading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { initials } from '@/lib/utils';
import { useGroup, useGroupMembers, useGroupInvites, useGroupSharedLists } from '@/hooks/groups';
import { useCurrentUser } from '@/hooks/auth';
import EditGroupForm from '@/components/edit-group-form';
import DeleteGroupButton from '@/components/delete-group-button';
import InviteMemberForm from '@/components/invite-member-form';
import PendingInviteItem from '@/components/pending-invite-item';
import MemberActionsMenu from '@/components/member-actions-menu';
import SharedListItem from '@/components/shared-list-item';
import { FavoriteButton } from '@/components/favorite-button';

export const Route = createFileRoute('/dashboard/groups/$id')({
  component: GroupPage,
  loader: async ({ context, params }) => {
    const group = await context.queryClient.query({
      ...convexQuery(api.groups.get, { id: params.id }),
      staleTime: 'static',
    });
    if (!group) {
      throw notFound();
    }
    await context.queryClient.query({
      ...convexQuery(api.groups.listMembers, { groupId: group._id }),
      staleTime: 'static',
    });
    await context.queryClient.query({
      ...convexQuery(api.listShares.sharedWithGroup, { groupId: group._id }),
      staleTime: 'static',
    });
    await context.queryClient.query({
      ...convexQuery(api.auth.getCurrentUser, {}),
      staleTime: 'static',
    });
  },
  pendingComponent: () => <p>Loading group…</p>,
});

function GroupPage() {
  const { id } = Route.useParams();
  const { group } = useGroup(id);
  const { user } = useCurrentUser();
  const [editingGroup, setEditingGroup] = useState(false);

  // `group` is only null on a race where access changed after the loader ran
  // (the loader already threw notFound() for that case); `groupId` falls back
  // to the (invalid) route id so the member/invite hooks always have an arg.
  const groupId = group?._id ?? (id as Id<'groups'>);
  const { members } = useGroupMembers(groupId);
  const [actionError, setActionError] = useState<string | null>(null);

  const myMembership = members?.find(m => m.userId === user?._id);
  const isOwner = myMembership?.role === 'owner';
  const isManager = isOwner || myMembership?.role === 'manager';

  return (
    <div className="space-y-5">
      <BackLink to="/dashboard/groups" breadcrumb>
        Groups
      </BackLink>

      <div className="flex justify-between items-start gap-2">
        <div className="w-full">
          {editingGroup && group ? (
            <EditGroupForm group={group} onDone={() => setEditingGroup(false)} />
          ) : (
            <div className="flex justify-between items-center">
              <h2 className={bigTitleClasses}>{group?.name}</h2>
              {group && (
                <div className="flex items-center gap-1 shrink-0">
                  <FavoriteButton kind="group" id={group._id} />
                  {isManager && (
                    <>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit group" onClick={() => setEditingGroup(true)}>
                        <Pencil />
                      </Button>
                      {isOwner && <DeleteGroupButton id={group._id} name={group.name} />}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <span className="text-muted-foreground">
            {members?.length ?? 0} member{members?.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList variant="line">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div>
            {actionError && <p className="text-destructive text-sm mt-1">{actionError}</p>}
            <ul className="mt-2 flex flex-col gap-3">
              {members?.map(member => (
                <li key={member.id} className="flex items-center space-between gap-2">
                  <Link to="/dashboard/users/$id" params={{ id: member.userId }} className="flex items-center flex-1 gap-2">
                    <Avatar size="sm">
                      {member.image && <AvatarImage src={member.image} alt={member.name} />}
                      <AvatarFallback style={{ backgroundColor: member.color }}>{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{member.name}</span>
                  </Link>
                  {member.role !== 'member' && <span className="text-muted-foreground text-xs capitalize">{member.role}</span>}
                  {member.userId !== user?._id && <FavoriteButton kind="user" id={member.userId} />}
                  {isManager && member.role !== 'owner' && member.userId !== user?._id && (
                    <MemberActionsMenu
                      groupId={groupId}
                      memberId={member.id}
                      memberName={member.name}
                      role={member.role}
                      canTransferOwnership={isOwner}
                      onError={setActionError}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isManager && (
            <div>
              <Heading>Invite</Heading>
              <div className="mt-2">
                <InviteMemberForm groupId={groupId} />
              </div>
              <PendingInvites groupId={groupId} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists">
          <GroupLists groupId={groupId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GroupLists({ groupId }: { groupId: Id<'groups'> }) {
  const { lists } = useGroupSharedLists(groupId);

  if (!lists || lists.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Gift />
          </EmptyMedia>
          <EmptyTitle>No lists shared here yet</EmptyTitle>
          <EmptyDescription>When a member shares a list with this group, it&apos;ll show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="mt-2 flex flex-col gap-4">
      {lists.map(list => (
        <SharedListItem key={list._id} {...list} />
      ))}
    </ul>
  );
}

function PendingInvites({ groupId }: { groupId: Id<'groups'> }) {
  const { invites } = useGroupInvites(groupId);
  if (invites.length === 0) return null;
  return (
    <ul className="mt-3 divide-y">
      {invites.map(invite => (
        <PendingInviteItem key={invite._id} invite={invite} />
      ))}
    </ul>
  );
}
