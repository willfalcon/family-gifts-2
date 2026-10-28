import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';

export function useLists() {
  return useQuery(api.lists.myLists);
}

export function useArchivedLists() {
  return useQuery(api.lists.myArchivedLists);
}

export function useList(id: Id<'lists'>) {
  return useQuery(api.lists.get, { id });
}

export function useItems(listId: Id<'lists'>) {
  return useQuery(api.items.list, { listId });
}

export function useListShares(listId: Id<'lists'>) {
  return useQuery(api.listShares.list, { listId });
}

export function useMyConnections() {
  return useQuery(api.listShares.myConnections);
}
