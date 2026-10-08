import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

export type FavoriteKind = 'user' | 'list' | 'group' | 'event';
export type Favorite = FunctionReturnType<typeof api.favorites.myFavorites>[number];

const TOGGLE_MUTATION = {
  user: api.favorites.toggleUserFavorite,
  list: api.favorites.toggleListFavorite,
  group: api.favorites.toggleGroupFavorite,
  event: api.favorites.toggleEventFavorite,
} as const;

// Deliberately a plain (non-suspense) query: a `FavoriteButton` can be
// dropped into any existing page without that page's loader needing to
// prefetch favorites first. It background-loads and the button just starts
// out unfavorited until it syncs.
export function useFavorites() {
  const { data } = useQuery(convexQuery(api.favorites.myFavorites, {}));
  return { favorites: data ?? [] };
}

export function useIsFavorited(kind: FavoriteKind, targetId: string) {
  const { favorites } = useFavorites();
  return favorites.some(f => f.kind === kind && f.targetId === targetId);
}

// The four toggle mutations take differently-typed `id`s (a plain string for
// a user, `Id<'lists'>` etc. for the rest) but are otherwise identical, so
// callers that dispatch on a runtime `kind` deal with one shared signature.
export function useToggleFavorite(kind: FavoriteKind) {
  const mutationFn = useConvexMutation(TOGGLE_MUTATION[kind]) as (args: { id: string }) => Promise<boolean>;
  return useMutation({ mutationFn });
}
