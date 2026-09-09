import { createFileRoute } from '@tanstack/react-router';
import { BigTitle } from '@/components/ui/big-title';
import { CreateListForm } from '@/components/create-list-form';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Gift } from 'lucide-react';
import ListListItem from '@/components/list-list-item';
import { useLists } from '@/hooks/lists';

export const Route = createFileRoute('/dashboard/lists/')({
  component: Lists,
});

function Lists() {
  const { lists, isPending } = useLists();

  return (
    <div>
      <BigTitle title="Lists" subtitle="Things you want, organized by occasion." />

      <CreateListForm />

      {isPending ? (
        <p>Loading lists…</p>
      ) : lists?.length === 0 ? (
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
