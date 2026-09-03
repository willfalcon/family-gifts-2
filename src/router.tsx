// src/router.tsx
/// <reference types="vite/client" />
import { createRouter } from '@tanstack/react-router';
import { QueryClient, notifyManager } from '@tanstack/react-query';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { ConvexQueryClient } from '@convex-dev/react-query';
import { ConvexProvider } from 'convex/react';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame);
  }

  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!CONVEX_URL) {
    throw new Error('Missing VITE_CONVEX_URL — run `npx convex dev` to provision a deployment.');
  }

  // expectAuth: true tells the client an auth token is coming, so it holds
  // queries until __root's beforeLoad sets it (avoids an unauthenticated flash).
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL, { expectAuth: true });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>{children}</ConvexProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
