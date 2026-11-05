import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';

// Everything behind sign-in. Signed-out visitors go to the welcome page, and
// come back here after logging in.
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.token) {
      throw redirect({ to: '/welcome', search: { redirect: location.href } });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
