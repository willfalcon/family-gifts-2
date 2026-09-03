// src/routes/__root.tsx
import type { ReactNode } from 'react';
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { authClient } from '../lib/auth-client';
import { getToken } from '../lib/auth-server';
import appCss from '../styles.css?url';

// Runs on the server: read the Better Auth session token for this request.
const fetchToken = createServerFn({ method: 'GET' }).handler(() => getToken());

export interface RouterContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  token?: string;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Family Gifts' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async (ctx) => {
    const token = await fetchToken();
    // Authenticate the SSR Convex client so loaders see the signed-in user.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return { token };
  },
  component: RootComponent,
});

function RootComponent() {
  const { convexQueryClient, token } = Route.useRouteContext();
  return (
    <ConvexBetterAuthProvider
      client={convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={token}
    >
      <RootDocument>
        <Outlet />
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
