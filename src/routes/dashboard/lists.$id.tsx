import { createFileRoute, notFound } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Gift, Pencil, Plus } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { BigTitle, bigTitleClasses } from '@/components/ui/big-title';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import ListItem from '@/components/list-item';
import { useItems, useList } from '@/hooks/lists';
import { useCurrentUser } from '@/hooks/auth';
import { useState } from 'react';
import AddItemForm from '@/components/add-item-form';
import EditListForm from '@/components/edit-list-form';
import DeleteListButton from '@/components/delete-list-button';
import ListSharing from '@/components/list-sharing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FavoriteButton } from '@/components/favorite-button';
import { initials } from '@/lib/utils';

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
    const user = await context.queryClient.query({
      ...convexQuery(api.auth.getCurrentUser, {}),
      staleTime: 'static',
    });
    // listShares.list is owner-only (it throws for anyone else) - only warm
    // it when this viewer actually is the owner, so a shared-with viewer
    // opening this page doesn't fail the loader on someone else's query.
    if (user && user._id === list.createdBy) {
      await context.queryClient.query({
        ...convexQuery(api.listShares.list, { listId: list._id }),
        staleTime: 'static',
      });
    }
  },
  pendingComponent: () => <p>Loading list…</p>,
});

function ListPage() {
  const { id } = Route.useParams();
  const { list } = useList(id);
  const { items } = useItems(id);
  const { user } = useCurrentUser();
  const isOwner = !!user && user._id === list?.createdBy;
  const count = items.length;
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const toggleForm = () => setItemFormOpen(!itemFormOpen);
  return (
    <div className="space-y-5">
      <BackLink to="/dashboard/lists" breadcrumb>
        Lists
      </BackLink>

      <div className="flex justify-between items-start gap-4">
        <div className="w-full">
          {editingList && list ? (
            <EditListForm list={list} onDone={() => setEditingList(false)} />
          ) : (
            <div className="flex justify-between items-center gap-4">
              <h2 className={bigTitleClasses}>{list?.title}</h2>
              {list && (
                <div className="flex items-center gap-1 shrink-0">
                  <FavoriteButton kind="list" id={list._id} />
                  {isOwner && (
                    <>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit list" onClick={() => setEditingList(true)}>
                        <Pencil />
                      </Button>
                      <DeleteListButton id={list._id} title={list.title} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <span className="flex flex-row gap-2 items-center">
            <Avatar size="sm">
              {list?.owner.image && <AvatarImage src={list.owner.image} alt={list.owner.name} />}
              <AvatarFallback>{initials(list?.owner.name ?? '')}</AvatarFallback>
            </Avatar>
            <span>{list?.owner.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {count} item{count !== 1 ? 's' : ''}
            </span>
          </span>
        </div>
      </div>

      {isOwner &&
        (itemFormOpen ? (
          <AddItemForm listId={id} toggleForm={toggleForm} />
        ) : (
          <Button variant="accent" onClick={toggleForm}>
            <Plus /> Add Item
          </Button>
        ))}

      {count === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gift />
            </EmptyMedia>
            <EmptyTitle>No items yet</EmptyTitle>
            <EmptyDescription>{isOwner ? 'Add the first thing you want to this list.' : `${list?.owner.name} hasn't added anything yet.`}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map(item => (
            <ListItem key={item._id} item={item} isOwner={isOwner} />
          ))}
        </ul>
      )}

      {isOwner && list && <ListSharing listId={list._id} />}
    </div>
  );
}
