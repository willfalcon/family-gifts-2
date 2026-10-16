import { Link } from '@tanstack/react-router';
import Heading from './ui/heading';
import { FavoriteButton } from './favorite-button';
import { Event } from '@convex/types';
import { formatWhen } from '@shared/event-dates';

export default function EventListItem(event: Event) {
  return (
    <Link
      to="/dashboard/events/$id"
      params={{ id: event._id }}
      className="border-b pb-4 flex justify-between items-start gap-4"
    >
      <div>
        <Heading>{event.name}</Heading>
        {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <p className="text-muted-foreground text-sm text-right">{formatWhen(event)}</p>
        <FavoriteButton kind="event" id={event._id} />
      </div>
    </Link>
  );
}
