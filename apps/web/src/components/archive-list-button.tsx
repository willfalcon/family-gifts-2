import { Archive } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';

// Archiving is reversible (see the banner on an archived list), so no confirm.
export default function ArchiveListButton({ id }: { id: Id<'lists'> }) {
  const navigate = useNavigate();
  const archiveList = useMutation({ mutationFn: useConvexMutation(api.lists.archive) });

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Archive list"
      disabled={archiveList.isPending}
      onClick={async () => {
        await archiveList.mutateAsync({ id });
        navigate({ to: '/dashboard/lists' });
      }}
    >
      <Archive />
    </Button>
  );
}
