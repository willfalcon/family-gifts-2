import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import type { AuthClient } from "@convex-dev/better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Native Better Auth client. Use its methods for auth actions, e.g.:
//   authClient.signIn.email({ email, password })
//   authClient.signUp.email({ email, password, name })
//   authClient.signOut()
//   authClient.useSession()
//
// baseURL is the Convex .site domain (where registerRoutes mounts Better
// Auth's HTTP routes), not the .cloud domain used for the Convex client.
//
// The cast bridges a known type-inference gap between createAuthClient's inferred
// type and the AuthClient shape ConvexBetterAuthProvider expects; runtime is fine.
export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  plugins: [
    expoClient({
      scheme: Constants.expoConfig?.scheme as string,
      storagePrefix: Constants.expoConfig?.scheme as string,
      storage: SecureStore,
    }),
    convexClient(),
  ],
}) as unknown as AuthClient;
