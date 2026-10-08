import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';

// Current signed-in user (the Better Auth user record, with `_id`), or null.
// `_id` is what every `createdBy` field on the app tables is compared against.
export function useCurrentUser() {
  const { data: user } = useQuery(convexQuery(api.auth.getCurrentUser, {}));
  return { user };
}
