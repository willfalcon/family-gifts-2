import type { ReactNode } from 'react';
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/auth-client';
import { getToken } from '@/lib/auth-server';
import { AlertHost } from '@/components/alerts';
import { APPEARANCE_SCRIPT } from '@/hooks/appearance';
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
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#FBFAF8' },
      { title: 'Family Gifts' },
      {
        name: 'description',
        content: 'Wish lists for the people you love. Claim a gift without spoiling the surprise.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
    ],
  }),
  beforeLoad: async ctx => {
    const token = await fetchToken();
    // Authenticate the SSR Convex client so server-side reads see the signed-in user.
    if (token) ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    return { token };
  },
  component: RootComponent,
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="display-title">Page not found</h1>
      <p className="text-ink-muted">That page doesn’t exist.</p>
      <a href="/" className="font-semibold text-accent">
        Go home
      </a>
    </main>
  ),
});

function RootComponent() {
  const { convexQueryClient, token } = Route.useRouteContext();
  return (
    <ConvexBetterAuthProvider client={convexQueryClient.convexClient} authClient={authClient} initialToken={token}>
      <RootDocument>
        <Outlet />
        <AlertHost />
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Applies the saved appearance before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
