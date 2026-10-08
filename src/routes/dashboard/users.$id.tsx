import { createFileRoute, notFound, redirect, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { BackLink } from '@/components/back-link';
import { BigTitle } from '@/components/ui/big-title';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Heading from '@/components/ui/heading';
import { FavoriteButton } from '@/components/favorite-button';
import { initials } from '@/lib/utils';

export const Route = createFileRoute('/dashboard/users/$id')({
  loader: async ({ context, params }) => {
    // Returns null when the viewer isn't allowed to see this profile, or the
    // user doesn't exist. Permission rules live in convex/permissions.ts.
    const profile = await context.queryClient.query({
      ...convexQuery(api.profiles.getPublic, { userId: params.id }),
      staleTime: 'static',
    });
    if (!profile) {
      throw notFound();
    }
  },
  component: RouteComponent,
});

function formatBirthday(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function RouteComponent() {
  const { id } = Route.useParams();
  const { data: profile } = useSuspenseQuery(convexQuery(api.profiles.getPublic, { userId: id }));

  // The loader already threw notFound() for a null profile; this keeps types honest.
  if (!profile) return null;

  return (
    <div className="flex flex-col gap-4">
      <BackLink to="/dashboard" />

      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {profile.image && <AvatarImage src={profile.image} alt={profile.name} />}
            <AvatarFallback>{initials(profile.name)}</AvatarFallback>
          </Avatar>
          <BigTitle>{profile.name}</BigTitle>
        </div>
        {!profile.isSelf && <FavoriteButton kind="user" id={profile.userId} />}
      </div>

      {profile.isSelf && (
        <p className="text-sm text-muted-foreground">
          This is your profile.{' '}
          <Link to="/dashboard/profile" className="text-accent">
            Edit it
          </Link>
        </p>
      )}

      <div>
        <Heading>Details</Heading>
        <dl className="mt-2 flex flex-col gap-2 text-sm">
          {profile.birthday && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Birthday</dt>
              <dd>{formatBirthday(profile.birthday)}</dd>
            </div>
          )}
          {profile.shirtSize && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Shirt size</dt>
              <dd>{profile.shirtSize}</dd>
            </div>
          )}
          {profile.notes && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Bio</dt>
              <dd className="whitespace-pre-wrap">{profile.notes}</dd>
            </div>
          )}
          {!profile.birthday && !profile.shirtSize && !profile.notes && <p className="text-muted-foreground">Nothing shared yet.</p>}
        </dl>
      </div>
    </div>
  );
}
