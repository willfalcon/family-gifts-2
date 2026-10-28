import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import DeleteListButton from '@/components/delete-list-button';

interface Props {
  id: Id<'lists'>;
  title: string;
}

// Shown to the owner on an archived list: restore it, or delete it for good.
export default function ArchivedListBanner({ id, title }: Props) {
  const unarchiveList = useMutation({ mutationFn: useConvexMutation(api.lists.unarchive) });

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3">
      <p className="text-sm text-muted-foreground">This list is archived. Only you can see it.</p>
      <div className="flex items-center gap-2 shrink-0">
        <DeleteListButton id={id} title={title} />
        <Button size="sm" disabled={unarchiveList.isPending} onClick={() => unarchiveList.mutate({ id })}>
          Restore
        </Button>
      </div>
    </div>
  );
}
