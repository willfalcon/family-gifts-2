import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { createAuth } from './auth';
import { MOCK_USERS, MOCK_USER_PASSWORD } from '../../shared/mock-users';

// Creates the mock accounts from packages/shared/mock-users.ts. Safe to run
// again: accounts that already exist are skipped.
//
//   npx convex run mockUsers:seed
//
// Refuses to run unless ENABLE_MOCK_USERS is "true" on the deployment, so it
// can't accidentally put known-password accounts on prod. Set it once on dev:
//
//   npx convex env set ENABLE_MOCK_USERS true
export const seed = internalAction({
  args: {},
  returns: v.object({ created: v.array(v.string()), skipped: v.array(v.string()) }),
  handler: async (ctx) => {
    if (process.env.ENABLE_MOCK_USERS !== 'true') {
      throw new Error('Mock users are disabled. Run `npx convex env set ENABLE_MOCK_USERS true` on a dev deployment.');
    }

    const auth = createAuth(ctx);
    const created: string[] = [];
    const skipped: string[] = [];

    // One at a time: each sign-up hashes a password and fires the profile trigger.
    for (const user of MOCK_USERS) {
      try {
        // The name parts aren't in Better Auth's types, but the sign-up hook in
        // convex/auth.ts reads them off the body.
        const body = { name: user.name, firstName: user.firstName, lastName: user.lastName, email: user.email, password: MOCK_USER_PASSWORD };
        await auth.api.signUpEmail({ body });
        created.push(user.email);
      } catch (error) {
        // Better Auth throws when the email is taken; anything else is a real failure.
        const message = error instanceof Error ? error.message : String(error);
        if (!/already exists/i.test(message)) throw error;
        skipped.push(user.email);
      }
    }

    return { created, skipped };
  },
});
