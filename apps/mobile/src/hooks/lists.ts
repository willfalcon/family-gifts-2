import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { useQuery } from '@tanstack/react-query';
import { Id } from '@convex/_generated/dataModel';

export function useLists() {
  return useQuery(convexQuery(api.lists.myLists, {}));
}

export function useList(id: Id<'lists'>) {
  return useQuery(convexQuery(api.lists.get, { id }));
}

export function useItems(listId: Id<'lists'>) {
  return useQuery(convexQuery(api.items.list, { listId }));
}

export function useListShares(listId: Id<'lists'>) {
  return useQuery(convexQuery(api.listShares.list, { listId }));
}

export function useMyConnections() {
  return useQuery(convexQuery(api.listShares.myConnections, {}));
}
