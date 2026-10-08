import Layout from '@/components/layout';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const viewer = await context.queryClient.query({
      ...convexQuery(api.auth.getCurrentUser, {}),
      staleTime: 'static',
    });
    if (!viewer) {
      throw notFound();
    }
  },
});

function RouteComponent() {
  return <Layout />;
}
