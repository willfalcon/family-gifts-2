import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

/** The signed-in user. `undefined` while loading, `null` when signed out. */
export function useUser() {
  return useQuery(api.auth.getCurrentUser);
}
