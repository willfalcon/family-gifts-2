import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { ChevronLeft, Gift, Plus } from 'lucide-react';
import { BigTitle } from '@/components/ui/big-title';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import ListItem from '@/components/list-item';
import { useItems, useList } from '@/hooks/lists';

export const Route = createFileRoute('/dashboard/lists/$id')({
  component: ListPage,
  loader: async ({ context, params }) => {
    const list = await context.queryClient.query({
      ...convexQuery(api.lists.get, { id: params.id }),
      staleTime: 'static',
    });
    if (!list) {
      throw notFound();
    }
    await context.queryClient.query({
      ...convexQuery(api.items.list, { listId: params.id }),
      staleTime: 'static',
    });
  },
  pendingComponent: () => <p>Loading list…</p>,
});

function ListPage() {
  const { id } = Route.useParams();
  const { list } = useList(id);
  const { items } = useItems(id);
  const count = items.length;

  return (
    <div>
      <Link to="/dashboard/lists" className="text-muted-foreground flex items-center gap-1">
        <ChevronLeft className="size-4" /> Lists
      </Link>

      <BigTitle>{list?.title}</BigTitle>
      <p className="text-muted-foreground mb-4">
        {count} item{count !== 1 ? 's' : ''}
      </p>

      <Button variant="accent">
        <Plus /> Add Item
      </Button>

      {count === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gift />
            </EmptyMedia>
            <EmptyTitle>No items yet</EmptyTitle>
            <EmptyDescription>Add the first thing you want to this list.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {items.map(item => (
            <ListItem key={item._id} {...item} />
          ))}
        </ul>
      )}
    </div>
  );
}
