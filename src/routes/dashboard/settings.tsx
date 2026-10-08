import { createFileRoute } from '@tanstack/react-router';
import { BackLink } from '@/components/back-link';

export const Route = createFileRoute('/dashboard/settings')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <BackLink to="/dashboard" />
    </div>
  );
}
