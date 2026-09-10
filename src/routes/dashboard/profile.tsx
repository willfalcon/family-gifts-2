import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/profile')({
  component: RouteComponent,
});

function RouteComponent() {
  return <p className="mb-4">Hello "/dashboard/profile"!</p>;
}
