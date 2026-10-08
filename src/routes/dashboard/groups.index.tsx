import { createFileRoute } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { BigTitle } from '@/components/ui/big-title';
import { CreateGroupForm } from '@/components/create-group-form';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Users } from 'lucide-react';
import GroupListItem from '@/components/group-list-item';
import { useGroups } from '@/hooks/groups';
import { Spinner } from '@/components/ui/spinner';

export const Route = createFileRoute('/dashboard/groups/')({
  component: Groups,
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...convexQuery(api.groups.myGroups, {}),
      staleTime: 'static',
    });
  },
  pendingComponent: () => (
    <div className="flex justify-center py-12">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  ),
});

function Groups() {
  const { groups } = useGroups();

  return (
    <div className="space-y-5">
      <BigTitle title="Groups" subtitle="Invite family and friends to coordinate gifts together." />

      <CreateGroupForm />

      {groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>Start one above - you can invite people by email once it's created.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul>
          {groups?.map(g => (
            <GroupListItem key={g._id} {...g} />
          ))}
        </ul>
      )}
    </div>
  );
}
