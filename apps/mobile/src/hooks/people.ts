import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

export function usePerson(id: string) {
  return useQuery(api.profiles.getPublic, { userId: id });
}

// Your own private ideas for this person. Only you ever see these.
export function usePrivateIdeas(forUserId: string | undefined) {
  return useQuery(api.privateIdeas.forPerson, forUserId ? { forUserId } : 'skip');
}
