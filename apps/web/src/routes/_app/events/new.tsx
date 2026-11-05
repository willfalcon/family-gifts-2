import { createFileRoute } from '@tanstack/react-router';

import { EventForm } from '@/components/event-form';

export const Route = createFileRoute('/_app/events/new')({
  head: () => ({ meta: [{ title: 'New Event · Family Gifts' }] }),
  component: () => <EventForm />,
});
