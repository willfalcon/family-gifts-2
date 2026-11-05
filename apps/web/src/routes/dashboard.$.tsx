import { createFileRoute, redirect } from '@tanstack/react-router';

// The old web app lived under /dashboard, and emails already sent (Secret
// Santa assignments, names drawn) still link to /dashboard/events/<id>.
// Everything moved up a level, so drop the prefix.
export const Route = createFileRoute('/dashboard/$')({
  beforeLoad: ({ params }) => {
    throw redirect({ href: `/${params._splat ?? ''}` });
  },
});
