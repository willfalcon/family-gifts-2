import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { ConvexError } from 'convex/values';
import { ArrowRight, Dices, PenLine, Send } from 'lucide-react';
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
import { cn } from '@/lib/utils';

function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  return 'Something went wrong';
}

interface SecretSantaData {
  participants: { userId: string; name: string }[];
  exclusions: { userId: string; excludedUserId: string }[];
  assignments: { giverUserId: string; giverName: string; receiverUserId: string; receiverName: string }[];
}

interface Props {
  eventId: Id<'events'>;
  secretSanta: SecretSantaData;
  onEdit: () => void;
}

export default function SecretSantaPreview({ eventId, secretSanta, onEdit }: Props) {
  const [swapSource, setSwapSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generate = useMutation({ mutationFn: useConvexMutation(api.secretSanta.generate) });
  const swap = useMutation({ mutationFn: useConvexMutation(api.secretSanta.swap) });
  const send = useMutation({ mutationFn: useConvexMutation(api.secretSanta.send) });

  async function handleRowClick(giverUserId: string) {
    setError(null);
    if (!swapSource) {
      setSwapSource(giverUserId);
      return;
    }
    if (swapSource === giverUserId) {
      setSwapSource(null);
      return;
    }
    try {
      await swap.mutateAsync({ eventId, giverAUserId: swapSource, giverBUserId: giverUserId });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSwapSource(null);
    }
  }

  async function handleShuffle() {
    setError(null);
    try {
      await generate.mutateAsync({
        eventId,
        participantUserIds: secretSanta.participants.map(p => p.userId),
        exclusions: secretSanta.exclusions,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-sm">
          Click two rows to swap their matches, or shuffle again for an entirely new set. Sending is the only step attendees can see.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <ul className="flex flex-col gap-1">
        {secretSanta.assignments.map(a => (
          <li key={a.giverUserId}>
            <button
              type="button"
              onClick={() => handleRowClick(a.giverUserId)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors',
                swapSource === a.giverUserId ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-ink/5'
              )}
            >
              <span className="flex-1">{a.giverName}</span>
              <ArrowRight className="text-muted-foreground size-4" />
              <span className="flex-1 text-right">{a.receiverName}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={send.isPending}>
              <Send />
              Send Secret Santa
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Send Secret Santa matches?</AlertDialogTitle>
              <AlertDialogDescription>
                Every participant gets an email revealing only their own match. Matches lock in and can&apos;t be edited afterward - you&apos;d
                need to reset and start over.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await send.mutateAsync({ eventId });
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Send
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="button" variant="outline" disabled={generate.isPending} onClick={handleShuffle}>
          <Dices />
          Shuffle Again
        </Button>
        <Button type="button" variant="ghost" onClick={onEdit}>
          <PenLine />
          Edit Participants
        </Button>
      </div>
    </div>
  );
}
