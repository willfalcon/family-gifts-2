import { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { FieldRow } from '@/components/profile-form';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/screens/secret-santa-setup';

import { api } from '@convex/_generated/api';

export interface GiftReadyPerson {
  userId: string;
  name: string;
  color: Parameters<typeof PersonAvatar>[0]['person']['color'];
  giftReady: boolean;
}

// "I have their gift", plus how many in the draw are Gift ready. The switch
// only names the Match once it's revealed, so it's safe to use while hidden.
// Hosts of a Reviewed draw also get `people`, to see who has their gift.
export default function GiftReady({
  eventId,
  myUserId,
  matchName,
  giftReady,
  progress,
  reviewed,
  people,
}: {
  eventId: Id<'events'>;
  myUserId?: string;
  matchName: string | null;
  // null when the viewer isn't in the draw (a host who's only running it):
  // there's no switch then.
  giftReady: boolean | null;
  progress: { ready: number; total: number };
  // In a Reviewed draw the hosts can see who has their gift.
  reviewed: boolean;
  people?: GiftReadyPerson[];
}) {
  const setGiftReady = useMutation(api.secretSanta.setGiftReady).withOptimisticUpdate((store, args) => {
    const state = store.getQuery(api.secretSanta.getState, { eventId: args.eventId });
    if (!state?.exists || !state.myAssignment || !state.giftProgress) return;
    const change = args.giftReady === state.myAssignment.giftReady ? 0 : args.giftReady ? 1 : -1;
    store.setQuery(
      api.secretSanta.getState,
      { eventId: args.eventId },
      {
        ...state,
        myAssignment: { ...state.myAssignment, giftReady: args.giftReady },
        giftProgress: { ...state.giftProgress, ready: state.giftProgress.ready + change },
        // A host's own row in the list below, so it flips with the switch.
        ...(state.isManager && {
          assignments: state.assignments.map(a =>
            a.giverUserId === myUserId ? { ...a, giftReady: args.giftReady } : a,
          ),
        }),
      },
    );
  });

  const label = matchName ? `I have ${matchName.split(' ')[0]}’s gift` : 'I have my Match’s gift';
  const fraction = progress.total > 0 ? progress.ready / progress.total : 0;

  return (
    <View className="gap-4">
      {giftReady !== null && (
        <FieldRow>
          <View className="flex-1 pr-3">
            <Text>{label}</Text>
            <Text className="text-[13px] text-ink-muted">
              {reviewed ? 'Hosts can see who has their gift' : 'Only counts toward the total. Nobody sees who it’s for'}
            </Text>
          </View>
          <Switch
            aria-label={label}
            checked={giftReady}
            onCheckedChange={checked => void setGiftReady({ eventId, giftReady: checked })}
          />
        </FieldRow>
      )}
      <View className="gap-2">
        <Text className="text-[15px] text-ink-muted">
          {progress.ready} out of {progress.total} have their gift
        </Text>
        <View
          className="h-2 w-full overflow-hidden rounded-full bg-fill"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: progress.total, now: progress.ready }}
        >
          <View className="h-full rounded-full bg-success" style={{ width: `${fraction * 100}%` }} />
        </View>
      </View>
      {people && people.length > 0 && (
        // Wrapping pills: green-bordered with a check once they have their
        // gift, plain until then. Both keep a 1px border so they're the same
        // size.
        <View className="flex-row flex-wrap gap-2">
          {people.map(person => (
            <View
              key={person.userId}
              className={cn(
                'flex-row items-center gap-1.5 rounded-pill border py-1 pl-1 pr-3',
                person.giftReady ? 'border-success bg-surface' : 'border-transparent bg-fill',
              )}
              accessible
              accessibilityLabel={`${person.name}: ${person.giftReady ? 'has their gift' : 'not yet'}`}
            >
              <PersonAvatar person={person} size={24} />
              <Text className="text-[15px]">{person.name}</Text>
              {person.giftReady && <Icon as={Check} size={14} className="text-success" />}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
