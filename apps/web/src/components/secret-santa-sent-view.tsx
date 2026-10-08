import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { ConvexError } from 'convex/values';
import { ArrowRight, RotateCcw } from 'lucide-react';
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

function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  return 'Something went wrong';
}

interface Props {
  eventId: Id<'events'>;
  assignments: { giverUserId: string; giverName: string; receiverUserId: string; receiverName: string }[];
}

export default function SecretSantaSentView({ eventId, assignments }: Props) {
  const [error, setError] = useState<string | null>(null);
  const reset = useMutation({ mutationFn: useConvexMutation(api.secretSanta.reset) });

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">Matches have been sent - each attendee sees only their own match under this tab.</p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <ul className="flex flex-col gap-1">
        {assignments.map(a => (
          <li key={a.giverUserId} className="flex items-center gap-2 rounded-lg p-2">
            <span className="flex-1">{a.giverName}</span>
            <ArrowRight className="text-muted-foreground size-4" />
            <span className="flex-1 text-right">{a.receiverName}</span>
          </li>
        ))}
      </ul>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline">
            <RotateCcw />
            Reset Secret Santa
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Secret Santa?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the current matches and exclusions. Attendees who already saw their match keep no record of it here -
              you&apos;ll need to set everything up again from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                try {
                  await reset.mutateAsync({ eventId });
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
