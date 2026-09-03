import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

// Server-side helpers for TanStack Start.
// - `handler` proxies /api/auth/* requests through to the Convex deployment.
// - `getToken` reads the current session token during SSR (used in __root beforeLoad).
// - `fetchAuth*` call Convex functions from the server as the signed-in user.
export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
  basePath: "/api/auth",
});
