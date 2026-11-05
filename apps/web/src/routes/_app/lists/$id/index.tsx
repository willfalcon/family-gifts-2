import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { Gift, Plus } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { confirm, showError } from '@/components/alerts';
import { ClaimableItemRow, NO_CLAIM, OwnItemRow } from '@/components/list-items';
import { ActionsMenu, EmptyState, NotFound, Page, PageHeader, useGoBack } from '@/components/page';
import { PrivateIdeaDialog } from '@/components/sheets';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/controls';
import { useItemClaims, useItems, useList, useListShares } from '@/hooks/data';
import { occasionParts } from '@/lib/occasion';
import { firstName } from '@/lib/utils';

export const Route = createFileRoute('/_app/lists/$id/')({
  head: () => ({ meta: [{ title: 'List · Family Gifts' }] }),
  component: ListPage,
});

// A list opened from anywhere: yours, or someone else's to claim from.
function ListPage() {
  const { id } = Route.useParams();
  const listId = id as Id<'lists'>;
  const list = useList(listId);
  if (list === undefined) return <Page>{null}</Page>;
  if (list === null) return <NotFound message="This list doesn’t exist or isn’t shared with you." />;
  return list.isMine ? <MyList listId={listId} /> : <TheirList listId={listId} />;
}

function MyList({ listId }: { listId: Id<'lists'> }) {
  const navigate = useNavigate();
  const goBack = useGoBack('/lists');
  const list = useList(listId);
  const items = useItems(listId);
  const shares = useListShares(listId);
  const archiveList = useMutation(api.lists.archive);
  const unarchiveList = useMutation(api.lists.unarchive);
  const removeList = useMutation(api.lists.remove);
  const archived = list?.archivedAt !== undefined;
  const sharedWithGroups = shares?.filter(s => s.kind === 'group') ?? [];

  const subtitle = [
    ...(list?.occasion ? [occasionParts(list, 'My birthday').join(' · ')] : []),
    ...(sharedWithGroups.length > 0 ? [`Shared with ${sharedWithGroups.map(g => g.name).join(', ')}`] : []),
  ].join(' · ');

  async function confirmDelete() {
    const ok = await confirm({
      title: 'Delete this list?',
      message: 'This list and all of its items will be permanently removed.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeList({ id: listId });
      navigate({ to: '/lists', replace: true });
    } catch (e) {
      showError('Couldn’t delete the list', e);
    }
  }

  // "Paste a link": read the clipboard and start a new idea from it.
  async function pasteLink() {
    let link: string | undefined;
    try {
      link = (await navigator.clipboard.readText()).trim();
    } catch {
      // No clipboard access: just open the form.
    }
    navigate({ to: '/lists/$id/add', params: { id: listId }, search: link ? { link } : {} });
  }

  return (
    <Page>
      <PageHeader
        title={list?.title}
        subtitle={subtitle || undefined}
        fallback="/lists"
        actions={
          <>
            <Button asChild variant="ghost" size="icon" className="glass">
              <Link to="/lists/$id/add" params={{ id: listId }} aria-label="Add an idea" title="Add an idea">
                <Plus className="size-[18px]" />
              </Link>
            </Button>
            <ActionsMenu
              label="List options"
              // Archiving is reversible, so it's the default way to remove a
              // list. Permanent delete is only offered once it's archived.
              actions={
                archived
                  ? [
                      { label: 'Restore List', onSelect: () => void unarchiveList({ id: listId }) },
                      { label: 'Delete Permanently', onSelect: confirmDelete, destructive: true },
                    ]
                  : [
                      { label: 'Edit List', onSelect: () => navigate({ to: '/lists/$id/edit', params: { id: listId } }) },
                      {
                        label: 'Archive List',
                        onSelect: async () => {
                          await archiveList({ id: listId });
                          goBack();
                        },
                      },
                    ]
              }
            />
          </>
        }
      />

      {items?.length === 0 && (
        <EmptyState
          icon={Gift}
          title="Add your first idea"
          body="Paste a link from any store, or just type what you’d like."
        >
          <div className="flex gap-2">
            <Button onClick={pasteLink}>Paste a link</Button>
            <Button asChild variant="secondary">
              <Link to="/lists/$id/add" params={{ id: listId }}>
                Type it in
              </Link>
            </Button>
          </div>
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col">
          {items.map(item => (
            <OwnItemRow key={item._id} item={item} />
          ))}
          <Link to="/lists/$id/add" params={{ id: listId }} className="mt-2 flex items-center gap-2 py-2 text-accent hover:underline">
            <Plus className="size-4" />
            Add an idea
          </Link>
          <p className="mt-4 text-footnote text-ink-muted">
            Click an idea to edit it, or use its menu for more. You won’t see what’s been claimed or bought, so nothing
            gets spoiled.
          </p>
        </div>
      )}
    </Page>
  );
}

type Filter = 'all' | 'open';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Still open', value: 'open' },
];

// Someone else's list: browse and claim their ideas.
function TheirList({ listId }: { listId: Id<'lists'> }) {
  const list = useList(listId);
  const items = useItems(listId);
  const claims = useItemClaims(listId);
  const [filter, setFilter] = useState<Filter>('all');
  const [ideaOpen, setIdeaOpen] = useState(false);

  const ownerName = list?.owner.name;
  const first = firstName(ownerName);
  const isOpen = (item: NonNullable<typeof items>[number]) =>
    (claims?.[item._id] ?? NO_CLAIM).claimedQuantity < Math.max(1, item.quantity ?? 1);
  const openItems = items?.filter(isOpen);
  const visibleItems = filter === 'open' ? openItems : items;

  const details: string[] = [];
  if (ownerName) details.push(ownerName);
  if (list) details.push(...occasionParts(list, `${first ?? 'Their'}'s birthday`));

  return (
    <Page className="gap-6">
      <PageHeader
        title={list?.title ?? ''}
        subtitle={
          details.length > 0 && (
            <>
              {list && (
                <Link to="/people/$id" params={{ id: list.owner.userId }} className="hover:underline">
                  {ownerName}
                </Link>
              )}
              {details.length > 1 && ` · ${details.slice(1).join(' · ')}`}
            </>
          )
        }
        actions={<ActionsMenu label="List options" actions={[{ label: 'Add private idea', onSelect: () => setIdeaOpen(true) }]} />}
      />

      {items && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl aria-label="Show" options={FILTERS} value={filter} onChange={setFilter} />
          {openItems && (
            <p className="text-sm text-ink-muted">
              {openItems.length} of {items.length} still open
            </p>
          )}
        </div>
      )}

      {items?.length === 0 && (
        <EmptyState icon={Gift} title="Nothing here yet" body={`${first ?? 'They'} hasn’t added any ideas to this list.`} />
      )}
      {visibleItems && visibleItems.length === 0 && items && items.length > 0 && (
        <EmptyState icon={Gift} title="Everything’s claimed" body="Every idea on this list has been claimed." />
      )}
      {visibleItems && visibleItems.length > 0 && (
        <div className="flex flex-col">
          {visibleItems.map(item => (
            <ClaimableItemRow key={item._id} item={item} claim={claims?.[item._id] ?? NO_CLAIM} />
          ))}
        </div>
      )}

      {list && (
        <PrivateIdeaDialog open={ideaOpen} onClose={() => setIdeaOpen(false)} forUserId={list.owner.userId} personName={first} />
      )}
    </Page>
  );
}
