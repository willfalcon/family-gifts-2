import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Cake, Calendar, ChevronDown, ChevronRight, Gift, Plus, TreePine } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { confirm, showError } from '@/components/alerts';
import { IconTile } from '@/components/avatar';
import { ActionsMenu, EmptyState, Page, TabHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useArchivedLists, useListShares, useLists } from '@/hooks/data';
import { formatOccasionDate } from '@/lib/occasion';

export const Route = createFileRoute('/_app/lists/')({
  head: () => ({ meta: [{ title: 'My Lists · Family Gifts' }] }),
  component: MyLists,
});

function MyLists() {
  const lists = useLists();
  const archivedLists = useArchivedLists();
  const [showArchived, setShowArchived] = useState(false);

  return (
    <Page className="gap-6">
      <TabHeader
        title="My Lists"
        action={
          <Button asChild variant="ghost" size="icon" className="glass">
            <Link to="/lists/new" aria-label="Add list" title="Add list">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />

      {lists && lists.length === 0 && !archivedLists?.length ? (
        <EmptyState
          icon={Gift}
          title="Start your first list"
          body="Add things you’d love from any store, or just type them in. Share the list with family when you’re ready."
        >
          <Button asChild size="lg" className="mt-4 w-full max-w-xs">
            <Link to="/lists/new">Create a list</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {lists?.map(list => <ListRow key={list._id} list={list} />)}
          <Link to="/lists/new" className="flex items-center gap-3 py-1 text-accent hover:underline">
            <span className="flex size-11 items-center justify-center">
              <Plus className="size-5" />
            </span>
            Add List
          </Link>

          {!!archivedLists?.length && (
            <button
              type="button"
              className="mt-6 flex items-center gap-1 self-start py-2 font-semibold text-ink-muted"
              aria-expanded={showArchived}
              onClick={() => setShowArchived(v => !v)}
            >
              Archived · {archivedLists.length}
              {showArchived ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          )}
          {showArchived && archivedLists?.map(list => <ListRow key={list._id} list={list} archived />)}
        </div>
      )}
    </Page>
  );
}

type MyList = FunctionReturnType<typeof api.lists.myLists>[number];

function listIcon(occasion: MyList['occasion']) {
  switch (occasion?.kind) {
    case 'event':
      return Calendar;
    case 'birthday':
      return Cake;
    case 'christmas':
      return TreePine;
    default:
      return Gift;
  }
}

// One of your lists. Mobile's swipe and long-press actions live in the "…" menu.
function ListRow({ list, archived = false }: { list: MyList; archived?: boolean }) {
  const navigate = useNavigate();
  const shares = useListShares(list._id);
  const archiveList = useMutation(api.lists.archive);
  const unarchiveList = useMutation(api.lists.unarchive);
  const groupShares = shares?.filter(s => s.kind === 'group') ?? [];

  const details: string[] = [];
  if (list.occasionEventName) details.push(list.occasionEventName);
  if (list.occasionEventDate) details.push(formatOccasionDate(list.occasionEventDate));
  if (groupShares.length > 0) details.push(`Shared with ${groupShares.length} group${groupShares.length > 1 ? 's' : ''}`);
  const Icon = listIcon(list.occasion);

  async function archive() {
    const ok = await confirm({
      title: 'Archive List',
      message: `${list.title} moves to Archived. You can restore it any time.`,
      confirmText: 'Archive',
      destructive: true,
    });
    if (ok) archiveList({ id: list._id }).catch(e => showError('Couldn’t archive the list', e));
  }

  return (
    <div className="flex items-center gap-3 py-1">
      <Link to="/lists/$id" params={{ id: list._id }} className="flex min-w-0 flex-1 items-center gap-3">
        <IconTile icon={Icon} />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-line pt-2 pb-3">
          <span className="min-w-0">
            <span className="block truncate text-button-lg font-semibold">{list.title}</span>
            {details.length > 0 && <span className="block truncate text-sm text-ink-muted">{details.join(' • ')}</span>}
          </span>
          <span className="flex items-center gap-1 text-ink-muted">
            {list.itemCount}
            <ChevronRight className="size-4 text-ink-faint" />
          </span>
        </span>
      </Link>
      <ActionsMenu
        label={`Options for ${list.title}`}
        actions={[
          { label: 'Edit', onSelect: () => navigate({ to: '/lists/$id/edit', params: { id: list._id } }) },
          archived
            ? { label: 'Unarchive', onSelect: () => void unarchiveList({ id: list._id }) }
            : { label: 'Archive', onSelect: archive, destructive: true },
        ]}
      />
    </div>
  );
}
