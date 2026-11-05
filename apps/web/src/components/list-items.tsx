import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { Gift } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import type { ItemWithImage } from '@convex/types';
import { confirm, showAlert } from '@/components/alerts';
import { ActionsMenu } from '@/components/page';
import { cn, errorMessage, joinNames } from '@/lib/utils';

// How much of an item is claimed - only passed when viewing someone else's
// list. The owner never gets this, so they never see claims.
export type ItemClaim = { claimedQuantity: number; myQuantity: number; otherClaimers: string[] };

export const NO_CLAIM: ItemClaim = { claimedQuantity: 0, myQuantity: 0, otherClaimers: [] };

// How many of an item the owner wants. Unset means one.
export function wantedQuantity(item: { quantity?: number }) {
  return Math.max(1, item.quantity ?? 1);
}

export function claimStatus(wanted: number, claim: ItemClaim) {
  if (claim.claimedQuantity === 0) return wanted > 1 ? `Wants ${wanted}` : undefined;
  if (wanted === 1) {
    return claim.myQuantity > 0 ? 'You’re getting this' : `Claimed by ${joinNames(claim.otherClaimers, 'someone')}`;
  }
  if (claim.myQuantity > 0) return `You’re getting ${claim.myQuantity}`;
  return `${claim.claimedQuantity} of ${wanted} claimed by ${joinNames(claim.otherClaimers, 'someone')}`;
}

// Claim one more of an item (or the first one), or drop your claim. Errors -
// like someone else grabbing the last one first - show as an alert.
export function useClaimActions(itemId: Id<'items'>, claim: ItemClaim) {
  const claimItem = useMutation(api.claims.claim);
  const unclaimItem = useMutation(api.claims.unclaim);
  const run = async (action: Promise<unknown>) => {
    try {
      await action;
      return true;
    } catch (e) {
      showAlert(errorMessage(e, 'Couldn’t update your claim.'));
      return false;
    }
  };
  return {
    claimOneMore: () => run(claimItem({ itemId, quantity: claim.myQuantity + 1 })),
    unclaim: () => run(unclaimItem({ itemId })),
  };
}

// Three rising bars, filled up to the priority level.
const BAR_COLOR = { low: 'bg-slate', medium: 'bg-amber', high: 'bg-accent' };
const LEVEL = { low: 1, medium: 2, high: 3 };

export function PriorityBadge({ priority }: { priority: Doc<'items'>['priority'] }) {
  if (!priority) return null;
  return (
    <span className="flex items-end gap-0.5" title={`${priority} priority`}>
      <span className="sr-only">{priority} priority</span>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={cn('w-1 rounded-[1px]', i < LEVEL[priority] ? BAR_COLOR[priority] : 'bg-line')}
          style={{ height: 6 + i * 4 }}
        />
      ))}
    </span>
  );
}

export function ItemImage({ url, size = 44, muted }: { url: string | null | undefined; size?: number; muted?: boolean }) {
  return url ? (
    <img
      src={url}
      alt=""
      className={cn('shrink-0 rounded-[10px] object-cover', muted && 'opacity-50')}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-[10px] bg-fill', muted && 'opacity-50')}
      style={{ width: size, height: size }}
    >
      <Gift className="size-5 text-ink-muted" />
    </span>
  );
}

function ItemSummary({ item, status }: { item: ItemWithImage; status?: string }) {
  const detail = [item.notes, item.price != null ? `$${item.price}` : null].filter(Boolean).join(' • ');
  return (
    <span className="flex min-w-0 flex-1 gap-3 py-2">
      {item.imageUrl && <ItemImage url={item.imageUrl} size={60} />}
      <span className="flex min-w-0 flex-1 flex-col justify-center border-b border-line pb-2">
        <span className="flex items-center gap-2">
          <span className="truncate text-lg">{item.name}</span>
          <PriorityBadge priority={item.priority} />
        </span>
        {status ? (
          <span className="text-sm text-accent">{status}</span>
        ) : (
          detail && <span className="truncate text-sm text-ink-muted">{detail}</span>
        )}
      </span>
    </span>
  );
}

// One of your own ideas: open to edit; the menu has priority and delete.
export function OwnItemRow({ item }: { item: ItemWithImage }) {
  const navigate = useNavigate();
  const removeItem = useMutation(api.items.remove);
  const updatePriority = useMutation(api.items.updatePriority);
  const edit = () => navigate({ to: '/lists/$id/items/$itemId', params: { id: item.listId, itemId: item._id } });

  async function confirmDelete() {
    const ok = await confirm({ title: 'Delete Item', message: `${item.name} will be removed from this list.`, confirmText: 'Delete', destructive: true });
    if (ok) void removeItem({ id: item._id });
  }

  return (
    <div className="flex items-center gap-2">
      <Link to="/lists/$id/items/$itemId" params={{ id: item.listId, itemId: item._id }} className="flex min-w-0 flex-1">
        <ItemSummary item={item} />
      </Link>
      <ActionsMenu
        label={`Options for ${item.name}`}
        actions={[
          { label: 'Edit', onSelect: edit },
          ...(['high', 'medium', 'low'] as const).map(p => ({
            label: `${item.priority === p ? '✓ ' : ''}${p.charAt(0).toUpperCase() + p.slice(1)} priority`,
            onSelect: () => void updatePriority({ id: item._id, priority: p }),
          })),
          { label: 'Move to List', onSelect: edit },
          { label: 'Delete', onSelect: confirmDelete, destructive: true },
        ]}
      />
    </div>
  );
}

// Someone else's idea: claim it, take one more of it, or let it go.
export function ClaimableItemRow({ item, claim }: { item: ItemWithImage; claim: ItemClaim }) {
  const { claimOneMore, unclaim } = useClaimActions(item._id, claim);
  const wanted = wantedQuantity(item);
  const left = wanted - claim.claimedQuantity;
  return (
    <div className="flex items-center gap-2">
      <Link to="/lists/$id/items/$itemId" params={{ id: item.listId, itemId: item._id }} className="flex min-w-0 flex-1">
        <ItemSummary item={item} status={claimStatus(wanted, claim)} />
      </Link>
      <ActionsMenu
        label={`Options for ${item.name}`}
        actions={[
          left > 0 && { label: claim.myQuantity > 0 ? 'Claim one more' : 'Claim', onSelect: () => void claimOneMore() },
          claim.myQuantity > 0 && { label: 'Unclaim', onSelect: () => void unclaim(), destructive: true },
        ]}
      />
    </div>
  );
}
