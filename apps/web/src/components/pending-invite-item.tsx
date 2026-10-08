import { X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Doc } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';

interface Props {
  invite: Doc<'groupInvites'>;
}

export default function PendingInviteItem({ invite }: Props) {
  const revokeInvite = useMutation({ mutationFn: useConvexMutation(api.groups.revokeInvite) });

  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-muted-foreground">{invite.email}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Revoke invite"
        onClick={() => revokeInvite.mutate({ id: invite._id })}
      >
        <X />
      </Button>
    </li>
  );
}
