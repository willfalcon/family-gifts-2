import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';

import type { Id } from '@convex/_generated/dataModel';
import { ItemForm } from '@/components/item-form';
import { claimStatus, NO_CLAIM, PriorityBadge, useClaimActions, wantedQuantity } from '@/components/list-items';
import { NotFound, Page, PageHeader, SheetPage, useGoBack } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useItemClaims, useItems, useList } from '@/hooks/data';
import { firstName, linkLabel } from '@/lib/utils';

export const Route = createFileRoute('/_app/lists/$id/items/$itemId')({
  head: () => ({ meta: [{ title: 'Item · Family Gifts' }] }),
  component: ItemPage,
});

// An idea on a list: an edit form when it's yours, its details (and claiming)
// when it's someone else's.
function ItemPage() {
  const { id, itemId } = Route.useParams();
  const listId = id as Id<'lists'>;
  const list = useList(listId);
  const items = useItems(listId);
  const item = items?.find(i => i._id === itemId);

  if (list === undefined || items === undefined) return <Page>{null}</Page>;
  if (list === null) return <NotFound message="This list doesn’t exist or isn’t shared with you." />;
  if (!item) return <NotFound message="This idea isn’t on the list anymore." />;
  return list.isMine ? <EditItem listId={listId} item={item} /> : <TheirItem listId={listId} itemId={itemId as Id<'items'>} />;
}

function EditItem({ listId, item }: { listId: Id<'lists'>; item: NonNullable<ReturnType<typeof useItems>>[number] }) {
  const goBack = useGoBack();
  const [busy, setBusy] = useState(false);
  return (
    <SheetPage title="Edit Item" action={{ label: 'Save', form: 'edit-item', disabled: busy }}>
      <ItemForm formId="edit-item" listId={listId} item={item} onDone={goBack} onBusyChange={setBusy} />
    </SheetPage>
  );
}

function TheirItem({ listId, itemId }: { listId: Id<'lists'>; itemId: Id<'items'> }) {
  const list = useList(listId);
  const items = useItems(listId);
  const claims = useItemClaims(listId);
  const item = items?.find(i => i._id === itemId);
  const claim = (item && claims?.[item._id]) || NO_CLAIM;
  const { claimOneMore, unclaim } = useClaimActions(itemId, claim);
  const [claiming, setClaiming] = useState(false);
  if (!item || !list) return null;

  const wanted = wantedQuantity(item);
  const left = wanted - claim.claimedQuantity;
  const status = claimStatus(wanted, claim);
  const owner = firstName(list.owner.name);
  const priceRow = [item.price !== undefined && `$${item.price}`, item.link && linkLabel(item.link)].filter(Boolean);

  const update = async (action: () => Promise<boolean>) => {
    setClaiming(true);
    await action();
    setClaiming(false);
  };

  return (
    <Page className="gap-6">
      <PageHeader title="" fallback="/" />
      <div className="flex flex-col gap-4">
        {item.imageUrl && (
          <img src={item.imageUrl} alt="" className="size-60 self-center rounded-[20px] object-contain" />
        )}
        <div className="flex flex-col gap-1 text-center">
          <Link to="/lists/$id" params={{ id: listId }} className="text-[14px] text-ink-muted hover:underline">
            From {list.title}
          </Link>
          <h1 className="flex items-center justify-center gap-2 text-[24px] font-bold text-ink">
            {item.name}
            <PriorityBadge priority={item.priority} />
          </h1>
        </div>
        {priceRow.length > 0 && <p className="text-center text-ink-muted">{priceRow.join(' at ')}</p>}
        {item.notes && <p className="whitespace-pre-line">{item.notes}</p>}
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
        {status && <p className="text-center text-sm text-accent">{status}</p>}
        {left > 0 && claim.myQuantity === 0 && (
          <Button size="lg" onClick={() => update(claimOneMore)} disabled={claiming}>
            I’ll get this
          </Button>
        )}
        {left > 0 && claim.myQuantity > 0 && (
          <Button size="lg" onClick={() => update(claimOneMore)} disabled={claiming}>
            Claim one more
          </Button>
        )}
        {claim.myQuantity > 0 && (
          <Button size="lg" variant="secondary" onClick={() => update(unclaim)} disabled={claiming}>
            Unclaim
          </Button>
        )}
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 text-ink hover:underline"
          >
            Open in store <ExternalLink className="size-3.5" />
          </a>
        )}
        {owner && (
          <p className="text-center text-footnote text-ink-muted">
            {owner} never sees what’s claimed.
          </p>
        )}
      </div>
    </Page>
  );
}
