import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Item } from '@convex/types';
import ItemForm from '@/components/item-form';

interface Props {
  item: Item;
  onDone: () => void;
}

export default function EditItemForm({ item, onDone }: Props) {
  const updateItem = useMutation({ mutationFn: useConvexMutation(api.items.update) });

  return (
    <ItemForm
      submitLabel="Save"
      defaults={{ name: item.name, link: item.link, notes: item.notes, priority: item.priority, price: item.price }}
      onCancel={onDone}
      onSubmit={async values => {
        await updateItem.mutateAsync({ id: item._id, ...values });
        onDone();
      }}
    />
  );
}
