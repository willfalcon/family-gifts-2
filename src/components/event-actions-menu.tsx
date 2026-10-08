import { useState } from 'react';
import { MoreVertical, ShieldPlus, ShieldMinus, Crown, UserMinus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { ConvexError } from 'convex/values';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  return 'Something went wrong';
}

interface Props {
  eventId: Id<'events'>;
  attendeeId: Id<'eventAttendees'>;
  attendeeName: string;
  role: 'manager' | 'guest';
  canTransferOwnership: boolean;
  onError: (message: string) => void;
}

export default function EventActionsMenu({ eventId, attendeeId, attendeeName, role, canTransferOwnership, onError }: Props) {
  const [confirm, setConfirm] = useState<'remove' | 'transfer' | null>(null);
  const setAttendeeRole = useMutation({ mutationFn: useConvexMutation(api.events.setAttendeeRole) });
  const removeAttendee = useMutation({ mutationFn: useConvexMutation(api.events.removeAttendee) });
  const transferOwnership = useMutation({ mutationFn: useConvexMutation(api.events.transferOwnership) });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${attendeeName}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {role === 'guest' ? (
            <DropdownMenuItem
              onClick={() => setAttendeeRole.mutate({ eventId, attendeeId, role: 'manager' }, { onError: e => onError(errorMessage(e)) })}
            >
              <ShieldPlus className="size-3.75" />
              Promote to manager
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setAttendeeRole.mutate({ eventId, attendeeId, role: 'guest' }, { onError: e => onError(errorMessage(e)) })}
            >
              <ShieldMinus className="size-3.75" />
              Demote to guest
            </DropdownMenuItem>
          )}
          {canTransferOwnership && role === 'manager' && (
            <DropdownMenuItem onClick={() => setConfirm('transfer')}>
              <Crown className="size-3.75" />
              Make owner
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm('remove')}>
            <UserMinus className="size-3.75" />
            Remove from event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm === 'remove'} onOpenChange={open => !open && setConfirm(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {attendeeName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll lose access to this event. Their account isn&apos;t affected, and they can be invited again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                try {
                  await removeAttendee.mutateAsync({ eventId, attendeeId });
                } catch (e) {
                  onError(errorMessage(e));
                } finally {
                  setConfirm(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'transfer'} onOpenChange={open => !open && setConfirm(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Make {attendeeName} the owner?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll become a manager instead. Only {attendeeName} will be able to delete the event or transfer ownership again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await transferOwnership.mutateAsync({ eventId, attendeeId });
                } catch (e) {
                  onError(errorMessage(e));
                } finally {
                  setConfirm(null);
                }
              }}
            >
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
