import { createAuthClient } from 'better-auth/react';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { emailOTPClient } from 'better-auth/client/plugins';
import type { AuthClient } from '@convex-dev/better-auth/react';

// Browser-side Better Auth client. Requests go to this app's own
// /api/auth/* route, which proxies them to the Convex deployment (see
// lib/auth-server.ts), so the session cookie is first-party.
//
// Password reset by emailed code, same as mobile:
//   authClient.emailOtp.requestPasswordReset({ email })
//   authClient.emailOtp.resetPassword({ email, otp, password })
//
// The cast bridges a known type-inference gap between createAuthClient's inferred
// type and the AuthClient shape ConvexBetterAuthProvider expects; runtime is fine.
const client = createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
});

export const authClient = client as unknown as AuthClient &
  Pick<typeof client, 'emailOtp'>;

// After signing in or out, reload so the server-rendered shell picks up the
// new session cookie (the root route reads the token on the server).
export function reloadTo(path: string) {
  window.location.assign(path);
}
