import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import ItemForm from '@/components/item-form';

interface Props {
  // The list this item is being created in. Comes from the route param, so the
  // form never has to ask for it.
  listId: string;
  toggleForm: () => void;
}

export default function AddItemForm({ listId, toggleForm }: Props) {
  // `createdBy` is set server-side in api.items.create from the authenticated
  // user, so it's not a field here.
  const createItem = useMutation({ mutationFn: useConvexMutation(api.items.create) });

  return (
    <ItemForm
      submitLabel="Add item"
      onCancel={toggleForm}
      onSubmit={async values => {
        await createItem.mutateAsync({ listId: listId as Id<'lists'>, ...values });
        toggleForm();
      }}
    />
  );
}
