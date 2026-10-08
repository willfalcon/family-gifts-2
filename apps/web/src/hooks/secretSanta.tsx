import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';

export function useSecretSanta(eventId: Id<'events'>) {
  const { data: secretSanta } = useSuspenseQuery(convexQuery(api.secretSanta.getState, { eventId }));
  return { secretSanta };
}
