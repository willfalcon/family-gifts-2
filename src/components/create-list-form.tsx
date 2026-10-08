import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { Plus } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import ListForm from '@/components/list-form';

export function CreateListForm() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createList = useMutation({ mutationFn: useConvexMutation(api.lists.create) });

  if (!open) {
    return (
      <Button variant="link" className="text-accent hover:no-underline cursor-pointer pl-0" onClick={() => setOpen(true)}>
        <Plus />
        New List
      </Button>
    );
  }

  return (
    <ListForm
      submitLabel="Create"
      onCancel={() => setOpen(false)}
      onSubmit={async values => {
        const id = await createList.mutateAsync(values);
        setOpen(false);
        navigate({ to: '/dashboard/lists/$id', params: { id } });
      }}
    />
  );
}
