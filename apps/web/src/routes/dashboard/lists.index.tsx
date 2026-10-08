import { createFileRoute } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { BigTitle } from '@/components/ui/big-title';
import { CreateListForm } from '@/components/create-list-form';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Gift } from 'lucide-react';
import ListListItem from '@/components/list-list-item';
import { useLists } from '@/hooks/lists';
import { Spinner } from '@/components/ui/spinner';

export const Route = createFileRoute('/dashboard/lists/')({
  component: Lists,
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...convexQuery(api.lists.myLists, {}),
      staleTime: 'static',
    });
  },
  pendingComponent: () => (
    <div className="flex justify-center py-12">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  ),
});

function Lists() {
  const { lists } = useLists();

  return (
    <div className="space-y-5">
      <BigTitle title="Lists" subtitle="Things you want, organized by occasion." />

      <CreateListForm />

      {lists.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gift />
            </EmptyMedia>
            <EmptyTitle>No lists yet</EmptyTitle>
            <EmptyDescription>Start one above - you can add items, priorities, and links any time.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul>
          {lists?.map(l => (
            <ListListItem key={l._id} {...l} />
          ))}
        </ul>
      )}
    </div>
  );
}
