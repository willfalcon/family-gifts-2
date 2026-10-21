import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

/** The signed-in user. `undefined` while loading, `null` when signed out. */
export function useUser() {
  return useQuery(api.auth.getCurrentUser);
}

export function useProfile() {
  return useQuery(api.profiles.getMine);
}
