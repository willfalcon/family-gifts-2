import { useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { Plus } from 'lucide-react-native';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import ListForm from '@/components/list-form';
import { Text } from './ui/text';
export function CreateListForm() {
  const [open, setOpen] = useState(false);
  const createList = useConvexMutation(api.lists.create);

  if (!open) {
    return (
      <Button variant="link" className="color-accent pl-0" onPress={() => setOpen(true)}>
        <Plus className="text-accent" />
        <Text className="text-accent">New List</Text>
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
