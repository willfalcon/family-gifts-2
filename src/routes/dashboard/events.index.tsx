import { createFileRoute } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { BigTitle } from '@/components/ui/big-title';
import { CreateEventForm } from '@/components/create-event-form';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Calendar } from 'lucide-react';
import EventListItem from '@/components/event-list-item';
import { useEvents } from '@/hooks/events';
import { Spinner } from '@/components/ui/spinner';

export const Route = createFileRoute('/dashboard/events/')({
  component: Events,
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...convexQuery(api.events.myEvents, {}),
      staleTime: 'static',
    });
  },
  pendingComponent: () => (
    <div className="flex justify-center py-12">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  ),
});

function Events() {
  const { events } = useEvents();
  // Undated events sort last rather than throwing on the missing date.
  const sorted = [...events].sort((a, b) => (a.date ?? '￿').localeCompare(b.date ?? '￿'));

  return (
    <div className="space-y-5">
      <BigTitle title="Events" subtitle="Birthdays, holidays, and other gift-giving occasions." />

      <CreateEventForm />

      {sorted.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Calendar />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>Add one above to start planning around it.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-1">
          {sorted.map(event => (
            <EventListItem key={event._id} {...event} />
          ))}
        </div>
      )}
    </div>
  );
}
