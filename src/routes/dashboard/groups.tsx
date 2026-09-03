import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/groups')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/dashboard/groups"!</div>;
}
