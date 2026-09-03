import Layout from '@/components/layout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
});

function RouteComponent({ children }) {
  return <Layout>{children}</Layout>;
}
