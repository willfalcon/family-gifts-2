import { createFileRoute } from '@tanstack/react-router';

import { EventForm } from '@/components/event-form';

export const Route = createFileRoute('/_app/events/$id/edit')({
  head: () => ({ meta: [{ title: 'Edit Event · Family Gifts' }] }),
  component: EditEvent,
});

function EditEvent() {
  const { id } = Route.useParams();
  return <EventForm id={id} />;
}
