import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { Plus } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import EventForm from '@/components/event-form';

export function CreateEventForm() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createEvent = useMutation({ mutationFn: useConvexMutation(api.events.create) });

  if (!open) {
    return (
      <Button variant="link" className="text-accent hover:no-underline pl-0!" onClick={() => setOpen(true)}>
        <Plus />
        New Event
      </Button>
    );
  }

  return (
    <EventForm
      submitLabel="Create"
      onCancel={() => setOpen(false)}
      onSubmit={async values => {
        const id = await createEvent.mutateAsync(values);
        setOpen(false);
        navigate({ to: '/dashboard/events/$id', params: { id } });
      }}
    />
  );
}
