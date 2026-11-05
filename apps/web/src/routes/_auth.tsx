import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { safeRedirect } from '@/lib/utils';

// Signed-out pages (welcome, log in, password reset). Someone already signed
// in goes straight to the app.
export const Route = createFileRoute('/_auth')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.token) throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: () => (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-8">
      <Outlet />
    </main>
  ),
});
