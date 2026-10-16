import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Event } from '@convex/types';
import EventForm from '@/components/event-form';

interface Props {
  event: Event;
  onDone: () => void;
}

export default function EditEventForm({ event, onDone }: Props) {
  const updateEvent = useMutation({ mutationFn: useConvexMutation(api.events.update) });

  return (
    <EventForm
      submitLabel="Save"
      defaults={{
        name: event.name,
        description: event.description,
        date: event.date,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
      }}
      onCancel={onDone}
      onSubmit={async values => {
        await updateEvent.mutateAsync({ id: event._id, ...values });
        onDone();
      }}
    />
  );
}
