import { createFileRoute, Link, type LinkProps } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Gift, Users, Calendar, User as UserIcon, ChevronRight, Sparkles } from 'lucide-react';
import { BigTitle } from '@/components/ui/big-title';
import Heading from '@/components/ui/heading';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { FavoriteButton } from '@/components/favorite-button';
import ListListItem from '@/components/list-list-item';
import GroupListItem from '@/components/group-list-item';
import EventListItem from '@/components/event-list-item';
import { useLists } from '@/hooks/lists';
import { useGroups } from '@/hooks/groups';
import { useEvents } from '@/hooks/events';
import { useFavorites } from '@/hooks/favorites';
import type { Favorite } from '@/hooks/favorites';

export const Route = createFileRoute('/dashboard/')({
  component: Dashboard,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...convexQuery(api.lists.myLists, {}), staleTime: 'static' }),
      context.queryClient.query({ ...convexQuery(api.groups.myGroups, {}), staleTime: 'static' }),
      context.queryClient.query({ ...convexQuery(api.events.myEvents, {}), staleTime: 'static' }),
      context.queryClient.query({ ...convexQuery(api.favorites.myFavorites, {}) }),
    ]);
  },
  pendingComponent: () => (
    <div className="flex justify-center py-12">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  ),
});

const FAVORITE_ICON = { user: UserIcon, list: Gift, group: Users, event: Calendar } as const;

function FavoriteRow({ favorite }: { favorite: Favorite }) {
  const Icon = FAVORITE_ICON[favorite.kind];
  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <span className="flex-1 font-body">{favorite.title}</span>
      <FavoriteButton kind={favorite.kind} id={favorite.targetId} />
    </>
  );
  const className = 'border-b pb-3 flex items-center gap-3';

  switch (favorite.kind) {
    case 'user':
      return (
        <Link to="/dashboard/users/$id" params={{ id: favorite.targetId }} className={className}>
          {content}
        </Link>
      );
    case 'list':
      return (
        <Link to="/dashboard/lists/$id" params={{ id: favorite.targetId }} className={className}>
          {content}
        </Link>
      );
    case 'group':
      return (
        <Link to="/dashboard/groups/$id" params={{ id: favorite.targetId }} className={className}>
          {content}
        </Link>
      );
    case 'event':
      return (
        <Link to="/dashboard/events/$id" params={{ id: favorite.targetId }} className={className}>
          {content}
        </Link>
      );
  }
}

function Section({ title, seeAllTo, children }: { title: string; seeAllTo: LinkProps['to']; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Heading className="text-3xl">{title}</Heading>
        <Link to={seeAllTo} className="text-accent text-sm flex items-center gap-0.5">
          See all <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function Dashboard() {
  const { lists } = useLists();
  const { groups } = useGroups();
  const { events } = useEvents();
  const { favorites } = useFavorites();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter(e => !e.date || e.date >= today)
    .sort((a, b) => (a.date ?? '￿').localeCompare(b.date ?? '￿'))
    .slice(0, 3);

  const isEmpty = lists.length === 0 && groups.length === 0 && events.length === 0;

  return (
    <div className="space-y-6">
      <BigTitle title="Dashboard" subtitle="Everything you're keeping track of, in one place." />

      {isEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>Nothing here yet</EmptyTitle>
            <EmptyDescription>
              Start a <Link to="/dashboard/lists">list</Link>, create a <Link to="/dashboard/groups">group</Link>, or add an{' '}
              <Link to="/dashboard/events">event</Link> to get going.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {favorites.length > 0 && (
            <div className="space-y-2">
              <Heading className="text-3xl">Favorites</Heading>
              <ul className="flex flex-col gap-1">
                {favorites.map(favorite => (
                  <li key={favorite.id}>
                    <FavoriteRow favorite={favorite} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lists.length > 0 && (
            <Section title="Your lists" seeAllTo="/dashboard/lists">
              {lists.slice(0, 3).map(list => (
                <ListListItem key={list._id} {...list} />
              ))}
            </Section>
          )}

          {groups.length > 0 && (
            <Section title="Your groups" seeAllTo="/dashboard/groups">
              {groups.slice(0, 3).map(group => (
                <GroupListItem key={group._id} {...group} />
              ))}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Upcoming events" seeAllTo="/dashboard/events">
              {upcoming.map(event => (
                <EventListItem key={event._id} {...event} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
