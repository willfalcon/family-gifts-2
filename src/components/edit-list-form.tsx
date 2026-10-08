import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { List } from '@/types';
import ListForm from '@/components/list-form';

interface Props {
  list: List;
  onDone: () => void;
}

export default function EditListForm({ list, onDone }: Props) {
  const updateList = useMutation({ mutationFn: useConvexMutation(api.lists.update) });

  return (
    <ListForm
      update
      submitLabel="Save"
      defaults={{ title: list.title }}
      onCancel={onDone}
      onSubmit={async values => {
        await updateList.mutateAsync({ id: list._id, ...values });
        onDone();
      }}
    />
  );
}
