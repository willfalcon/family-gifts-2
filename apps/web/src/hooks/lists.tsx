import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { List } from '@convex/types';
import { Id } from '@convex/_generated/dataModel';

export function useLists() {
  const { data: lists } = useSuspenseQuery(convexQuery(api.lists.myLists, {}));
  return { lists };
}

// Not suspense: the archive is secondary, so it shouldn't hold up the page.
export function useArchivedLists() {
  const { data: lists } = useQuery(convexQuery(api.lists.myArchivedLists, {}));
  return { lists };
}

export function useList(listId: string) {
  const { data: list } = useSuspenseQuery(convexQuery(api.lists.get, { id: listId }));
  return { list };
}

export function useItems(listId: string) {
  const { data: items } = useSuspenseQuery(convexQuery(api.items.list, { listId }));
  return { items };
}

export function useListShares(listId: Id<'lists'>) {
  const { data: shares } = useSuspenseQuery(convexQuery(api.listShares.list, { listId }));
  return { shares };
}

export function useMyConnections() {
  const { data: connections } = useSuspenseQuery(convexQuery(api.listShares.myConnections, {}));
  return { connections };
}
