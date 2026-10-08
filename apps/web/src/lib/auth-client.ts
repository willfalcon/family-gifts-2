import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { AuthClient } from "@convex-dev/better-auth/react";

// Browser-side Better Auth client. Use its methods for auth actions, e.g.:
//   authClient.signIn.email({ email, password })
//   authClient.signUp.email({ email, password, name })
//   authClient.signOut()
//   authClient.useSession()
//
// The cast bridges a known type-inference gap between createAuthClient's inferred
// type and the AuthClient shape ConvexBetterAuthProvider expects; runtime is fine.
export const authClient = createAuthClient({
  plugins: [convexClient()],
}) as unknown as AuthClient;
