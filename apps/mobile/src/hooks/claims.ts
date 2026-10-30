import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useSegments } from 'expo-router';
import { Alert } from 'react-native';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { ItemClaim } from '@/components/list-item';

// Claim one more of an item (or the first one), or drop your claim. Errors -
// like someone else grabbing the last one first - show as an alert.
export function useClaimActions(itemId: Id<'items'>, claim: ItemClaim) {
  const claimItem = useMutation(api.claims.claim);
  const unclaimItem = useMutation(api.claims.unclaim);

  const run = async (action: Promise<unknown>) => {
    try {
      await action;
      return true;
    } catch (error) {
      Alert.alert(error instanceof ConvexError ? String(error.data) : "Couldn't update your claim.");
      return false;
    }
  };

  return {
    claimOneMore: () => run(claimItem({ itemId, quantity: claim.myQuantity + 1 })),
    unclaim: () => run(unclaimItem({ itemId })),
  };
}

// Someone else's list can be open in several tabs' stacks (dashboard, events,
// groups). Returns the path to an item's details in whichever one we're in.
export function useItemDetailsHref() {
  const segments = useSegments() as string[];
  const stack = segments[1] ?? '(groups)';
  return (listId: Id<'lists'>, itemId: Id<'items'>) => `/(app)/${stack}/lists/${listId}/items/${itemId}`;
}
