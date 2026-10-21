import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

export function useEvents() {
  return useQuery(api.events.myEvents);
}
