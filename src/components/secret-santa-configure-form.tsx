import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { ConvexError } from 'convex/values';
import { Check, Dices, X } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import Heading from '@/components/ui/heading';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';

function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  return 'Something went wrong';
}

interface Attendee {
  userId: string;
  name: string;
  image: string | null;
  color: string;
}

interface Exclusion {
  userId: string;
  excludedUserId: string;
}

interface Props {
  eventId: Id<'events'>;
  attendees: Attendee[];
  initialParticipantIds: string[];
  initialExclusions: Exclusion[];
  onGenerated?: () => void;
  onCancel?: () => void;
}

export default function SecretSantaConfigureForm({ eventId, attendees, initialParticipantIds, initialExclusions, onGenerated, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialParticipantIds));
  const [exclusions, setExclusions] = useState<Exclusion[]>(initialExclusions);
  const [error, setError] = useState<string | null>(null);
  const generate = useMutation({ mutationFn: useConvexMutation(api.secretSanta.generate) });

  const participants = attendees.filter(a => selected.has(a.userId));

  function toggle(userId: string) {
    const wasSelected = selected.has(userId);
    const next = new Set(selected);
    if (wasSelected) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelected(next);
    if (wasSelected) {
      setExclusions(prev => prev.filter(e => e.userId !== userId && e.excludedUserId !== userId));
    }
  }

  // One-directional: excluding giver -> receiver doesn't also exclude
  // receiver -> giver, so each direction is toggled independently.
  function toggleExclusion(giverUserId: string, receiverUserId: string) {
    setExclusions(prev => {
      const exists = prev.some(e => e.userId === giverUserId && e.excludedUserId === receiverUserId);
      if (exists) {
        return prev.filter(e => !(e.userId === giverUserId && e.excludedUserId === receiverUserId));
      }
      return [...prev, { userId: giverUserId, excludedUserId: receiverUserId }];
    });
  }

  async function handleGenerate() {
    setError(null);
    try {
      await generate.mutateAsync({ eventId, participantUserIds: [...selected], exclusions });
      onGenerated?.();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Heading>1. Who&apos;s playing?</Heading>
          <div className="flex items-center gap-1">
            <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setSelected(new Set(attendees.map(a => a.userId)))}>
              Select all
            </Button>
            <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setSelected(new Set())}>
              Select none
            </Button>
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          {attendees.map(attendee => {
            const isSelected = selected.has(attendee.userId);
            return (
              <li key={attendee.userId}>
                <button
                  type="button"
                  onClick={() => toggle(attendee.userId)}
                  aria-pressed={isSelected}
                  className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-ink/5"
                >
                  <Avatar size="sm">
                    {attendee.image && <AvatarImage src={attendee.image} alt={attendee.name} />}
                    <AvatarFallback style={{ backgroundColor: attendee.color }}>{initials(attendee.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{attendee.name}</span>
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border',
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    )}
                  >
                    {isSelected && <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <Heading>2. Exclusions</Heading>
        <p className="text-muted-foreground text-sm">
          Click a cell to stop the person in that row from being assigned to give to the person in that column. Excluding A → B doesn&apos;t
          exclude B → A - mark both if that&apos;s what you want.
        </p>
        {participants.length < 2 ? (
          <p className="text-muted-foreground text-sm italic">Pick at least 2 participants to set exclusions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="sticky left-0" />
                  {participants.map(receiver => (
                    <th key={receiver.userId} className="p-0 align-bottom pb-1">
                      <div className="flex justify-center" title={receiver.name}>
                        <Avatar size="sm">
                          {receiver.image && <AvatarImage src={receiver.image} alt={receiver.name} />}
                          <AvatarFallback style={{ backgroundColor: receiver.color }}>{initials(receiver.name)}</AvatarFallback>
                        </Avatar>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participants.map(giver => (
                  <tr key={giver.userId}>
                    <th className="sticky left-0 bg-background p-0 pr-2 font-normal whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" title={giver.name}>
                        <span className="text-sm">{giver.name}</span>
                        <Avatar size="sm">
                          {giver.image && <AvatarImage src={giver.image} alt={giver.name} />}
                          <AvatarFallback style={{ backgroundColor: giver.color }}>{initials(giver.name)}</AvatarFallback>
                        </Avatar>
                      </div>
                    </th>
                    {participants.map(receiver => {
                      const isSelf = giver.userId === receiver.userId;
                      const isExcluded = exclusions.some(e => e.userId === giver.userId && e.excludedUserId === receiver.userId);
                      return (
                        <td key={receiver.userId} className="p-0">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => toggleExclusion(giver.userId, receiver.userId)}
                            aria-label={`${giver.name} can${isExcluded ? "'t" : ''} be assigned to give to ${receiver.name}`}
                            aria-pressed={isExcluded}
                            className={cn(
                              'flex size-8 items-center justify-center rounded-md border transition-colors',
                              isSelf
                                ? 'border-transparent bg-muted'
                                : isExcluded
                                  ? 'border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25'
                                  : 'border-input hover:bg-ink/5'
                            )}
                          >
                            {isExcluded && <X className="size-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="button" disabled={selected.size < 2 || generate.isPending} onClick={handleGenerate}>
          <Dices />
          {generate.isPending ? 'Generating…' : 'Generate Matches'}
        </Button>
        {onCancel && (
          <Button type="button" variant="link" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
