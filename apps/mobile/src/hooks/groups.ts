import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

export function useGroups() {
  return useQuery(api.groups.myGroups);
}
