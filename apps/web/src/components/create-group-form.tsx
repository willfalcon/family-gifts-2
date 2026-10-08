import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { Plus } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import GroupForm from '@/components/group-form';

export function CreateGroupForm() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createGroup = useMutation({ mutationFn: useConvexMutation(api.groups.create) });

  if (!open) {
    return (
      <Button variant="link" className="text-accent hover:no-underline cursor-pointer pl-0" onClick={() => setOpen(true)}>
        <Plus />
        New Group
      </Button>
    );
  }

  return (
    <GroupForm
      submitLabel="Create"
      onCancel={() => setOpen(false)}
      onSubmit={async values => {
        const id = await createGroup.mutateAsync(values);
        setOpen(false);
        navigate({ to: '/dashboard/groups/$id', params: { id } });
      }}
    />
  );
}
