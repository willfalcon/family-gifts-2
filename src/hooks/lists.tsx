import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { List } from '@/types';
import { Id } from '@convex/_generated/dataModel';

export function useLists() {
  const { data: lists, isPending } = useQuery(convexQuery(api.lists.myLists, {}));
  return { lists, isPending };
}

export function useList(listId: string) {
  const { data: list } = useSuspenseQuery(convexQuery(api.lists.get, { id: listId }));
  return { list };
}

export function useItems(listId: string) {
  const { data: items } = useSuspenseQuery(convexQuery(api.items.list, { listId }));
  return { items };
}
