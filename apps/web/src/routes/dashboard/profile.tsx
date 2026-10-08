import { createFileRoute, redirect } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { BackLink } from '@/components/back-link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCurrentUser } from '@/hooks/auth';
import { initials } from '@/lib/utils';
import { BigTitle } from '@/components/ui/big-title';
import { ProfileForm } from '@/components/profile-form';

export const Route = createFileRoute('/dashboard/profile')({
  loader: async ({ context }) => {
    const user = await context.queryClient.query({
      ...convexQuery(api.auth.getCurrentUser, {}),
      staleTime: 'static',
    });
    if (!user) {
      throw redirect({ to: '/login' });
    }
    await context.queryClient.query({
      ...convexQuery(api.profiles.getMine, {}),
      staleTime: 'static',
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useCurrentUser();
  const { data: profile } = useQuery(convexQuery(api.profiles.getMine, {}));

  return (
    <div className="space-y-4">
      <BackLink to="/dashboard" />

      <div className="flex items-center">
        <Avatar size="lg">
          <AvatarFallback>{user ? initials(user.name) : null}</AvatarFallback>
        </Avatar>
        <BigTitle>{user?.name}</BigTitle>
      </div>

      <div>
        <h3 className="text-muted-foreground text-lg">Activity</h3>
        <div className="flex gap-2 items-center">
          <div className="flex flex-col">
            <span className="font-display text-2xl font-bold">2</span>
            <span className="text-muted-foreground text-sm">Lists</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl font-bold">1</span>
            <span className="text-muted-foreground text-sm">Group</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl font-bold">2</span>
            <span className="text-muted-foreground text-sm">Events</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-muted-foreground text-lg">Details</h3>
        {/* The form is the profile view for the current user - always editable,
            pre-filled with the current values. */}
        <ProfileForm
          defaults={{
            name: user?.name ?? '',
            birthday: profile?.birthday,
            shirtSize: profile?.shirtSize,
            notes: profile?.notes,
          }}
        />
      </div>
    </div>
  );
}
