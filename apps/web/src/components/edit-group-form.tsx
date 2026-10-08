import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Group } from '@/types';
import GroupForm from '@/components/group-form';

interface Props {
  group: Group;
  onDone: () => void;
}

export default function EditGroupForm({ group, onDone }: Props) {
  const updateGroup = useMutation({ mutationFn: useConvexMutation(api.groups.update) });

  return (
    <GroupForm
      update
      submitLabel="Save"
      defaults={{ name: group.name }}
      onCancel={onDone}
      onSubmit={async values => {
        await updateGroup.mutateAsync({ id: group._id, ...values });
        onDone();
      }}
    />
  );
}
