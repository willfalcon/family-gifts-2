import { createFileRoute, notFound } from '@tanstack/react-router';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Pencil, Gift } from 'lucide-react';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { bigTitleClasses } from '@/components/ui/big-title';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Heading from '@/components/ui/heading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { initials } from '@/lib/utils';
import { useEvent, useEventAttendees, useEventInvites, useEventSharedLists } from '@/hooks/events';
import { useCurrentUser } from '@/hooks/auth';
import EditEventForm from '@/components/edit-event-form';
import DeleteEventButton from '@/components/delete-event-button';
import InviteToEventForm from '@/components/invite-to-event-form';
import InviteGroupToEventForm from '@/components/invite-group-to-event-form';
import PendingEventInviteItem from '@/components/pending-event-invite-item';
import EventActionsMenu from '@/components/event-actions-menu';
import { formatWhen } from '@shared/event-dates';
import SharedListItem from '@/components/shared-list-item';
import SecretSantaTab from '@/components/secret-santa-tab';
import { FavoriteButton } from '@/components/favorite-button';

export const Route = createFileRoute('/dashboard/events/$id')({
  component: EventPage,
  loader: async ({ context, params }) => {
    const event = await context.queryClient.query({
      ...convexQuery(api.events.get, { id: params.id }),
      staleTime: 'static',
    });
    if (!event) {
      throw notFound();
    }
    await context.queryClient.query({
      ...convexQuery(api.events.listAttendees, { eventId: event._id }),
      staleTime: 'static',
    });
    await context.queryClient.query({
      ...convexQuery(api.listShares.sharedWithEvent, { eventId: event._id }),
      staleTime: 'static',
    });
    await context.queryClient.query({
      ...convexQuery(api.auth.getCurrentUser, {}),
      staleTime: 'static',
    });
    await context.queryClient.query({
      ...convexQuery(api.secretSanta.getState, { eventId: event._id }),
      staleTime: 'static',
    });
  },
  pendingComponent: () => <p>Loading event…</p>,
});

function EventPage() {
  const { id } = Route.useParams();
  const { event } = useEvent(id);
  const { user } = useCurrentUser();
  const [editingEvent, setEditingEvent] = useState(false);

  // `event` is only null on a race where access changed after the loader ran
  // (the loader already threw notFound() for that case); `eventId` falls back
  // to the (invalid) route id so the attendee/invite hooks always have an arg.
  const eventId = event?._id ?? (id as Id<'events'>);
  const { attendees } = useEventAttendees(eventId);
  const [actionError, setActionError] = useState<string | null>(null);

  const myAttendance = attendees?.find(a => a.userId === user?._id);
  const isOwner = myAttendance?.role === 'owner';
  const isManager = isOwner || myAttendance?.role === 'manager';

  return (
    <div className="space-y-5">
      <BackLink to="/dashboard/events" breadcrumb>
        Events
      </BackLink>

      <div className="flex justify-between items-start gap-4">
        <div className="w-full">
          {editingEvent && event ? (
            <EditEventForm event={event} onDone={() => setEditingEvent(false)} />
          ) : (
            <>
              <div className="flex justify-between items-center gap-4">
                <h2 className={bigTitleClasses}>{event?.name}</h2>
                {event && (
                  <div className="flex items-center gap-1 shrink-0">
                    <FavoriteButton kind="event" id={event._id} />
                    {isManager && (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label="Edit event" onClick={() => setEditingEvent(true)}>
                          <Pencil />
                        </Button>
                        {isOwner && <DeleteEventButton id={event._id} name={event.name} />}
                      </>
                    )}
                  </div>
                )}
              </div>
              {event && <p className="text-muted-foreground">{formatWhen(event)}</p>}
              {event?.description && <p className="mt-2 whitespace-pre-wrap">{event.description}</p>}
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="attendees">
        <TabsList variant="line">
          <TabsTrigger value="attendees">Attendees ({attendees?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="secret-santa">Secret Santa</TabsTrigger>
        </TabsList>

        <TabsContent value="attendees" className="space-y-4">
          <div>
            {actionError && <p className="text-destructive text-sm mt-1">{actionError}</p>}
            <ul className="mt-2 flex flex-col gap-3">
              {attendees?.map(attendee => (
                <li key={attendee.id} className="flex items-center gap-2">
                  <Avatar size="sm">
                    {attendee.image && <AvatarImage src={attendee.image} alt={attendee.name} />}
                    <AvatarFallback style={{ backgroundColor: attendee.color }}>{initials(attendee.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{attendee.name}</span>
                  {attendee.role !== 'guest' && <span className="text-muted-foreground text-xs capitalize">{attendee.role}</span>}
                  {attendee.userId !== user?._id && <FavoriteButton kind="user" id={attendee.userId} />}
                  {isManager && attendee.role !== 'owner' && attendee.userId !== user?._id && (
                    <EventActionsMenu
                      eventId={eventId}
                      attendeeId={attendee.id}
                      attendeeName={attendee.name}
                      role={attendee.role}
                      canTransferOwnership={isOwner}
                      onError={setActionError}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isManager && (
            <div className="space-y-3">
              <Heading>Invite</Heading>
              <InviteToEventForm eventId={eventId} />
              <InviteGroupToEventForm eventId={eventId} />
              <PendingInvites eventId={eventId} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists">
          <EventLists eventId={eventId} />
        </TabsContent>

        <TabsContent value="secret-santa">
          <SecretSantaTab eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventLists({ eventId }: { eventId: Id<'events'> }) {
  const { lists } = useEventSharedLists(eventId);

  if (!lists || lists.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Gift />
          </EmptyMedia>
          <EmptyTitle>No lists shared here yet</EmptyTitle>
          <EmptyDescription>When an attendee shares a list with this event, it&apos;ll show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="mt-2 flex flex-col gap-4">
      {lists.map(list => (
        <SharedListItem key={list._id} {...list} />
      ))}
    </ul>
  );
}

function PendingInvites({ eventId }: { eventId: Id<'events'> }) {
  const { invites } = useEventInvites(eventId);
  if (invites.length === 0) return null;
  return (
    <ul className="divide-y">
      {invites.map(invite => (
        <PendingEventInviteItem key={invite._id} invite={invite} />
      ))}
    </ul>
  );
}
