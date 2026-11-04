import { X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props {
  invite: { _id: Id<'eventAttendees'>; email: string; sourceGroupName: string | null };
}

export default function PendingEventInviteItem({ invite }: Props) {
  const revokeInvite = useMutation({ mutationFn: useConvexMutation(api.events.revokeInvite) });

  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-muted-foreground">
        {invite.email}
        {invite.sourceGroupName && <span className="text-xs"> · From {invite.sourceGroupName}</span>}
      </span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Revoke invite">
            <X />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invite?</AlertDialogTitle>
            <AlertDialogDescription>
              The invite sent to {invite.email} will stop working. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => revokeInvite.mutate({ id: invite._id })}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
