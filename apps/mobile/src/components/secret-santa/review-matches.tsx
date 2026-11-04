import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/screens/secret-santa-setup';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { swapProblem, type Exclusion, type SwapProblem } from '@shared/secret-santa';

type HostState = Extract<FunctionReturnType<typeof api.secretSanta.getState>, { isManager: true }>;
type Assignment = HostState['assignments'][number];

interface Props {
  eventId: Id<'events'>;
  assignments: Assignment[];
  exclusions: Exclusion[];
  // Matches can only be swapped until the names are sent.
  editable: boolean;
}

// Every Match in a Reviewed draw, for hosts. Before the names are sent, tap
// one row, then another, to swap who they're giving to. Rows that can't be
// swapped with the selected one (someone would get themselves, or two people
// kept apart would be matched) are dimmed.
export default function ReviewMatches({ eventId, assignments, exclusions, editable }: Props) {
  const swap = useMutation(api.secretSanta.swap);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const selected = editable ? assignments.find(a => a.giverUserId === selectedId) : undefined;
  const nameOf = new Map(assignments.map(a => [a.giverUserId, a.giverName]));

  function explain(problem: SwapProblem) {
    const name = nameOf.get(problem.userId) ?? 'Someone';
    return problem.kind === 'self'
      ? `${name} would be giving to themselves.`
      : `${name} and ${nameOf.get(problem.otherUserId) ?? 'their match'} are kept apart.`;
  }

  async function press(row: Assignment) {
    if (!editable || swapping) return;
    if (!selected) return setSelectedId(row.giverUserId);
    if (selected.giverUserId === row.giverUserId) return setSelectedId(null);

    const problem = swapProblem(selected, row, exclusions);
    if (problem) {
      Alert.alert('Can’t swap these two', explain(problem));
      return;
    }
    setSwapping(true);
    try {
      await swap({ eventId, giverAUserId: selected.giverUserId, giverBUserId: row.giverUserId });
      setSelectedId(null);
    } catch (e) {
      Alert.alert('Couldn’t swap', e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
    } finally {
      setSwapping(false);
    }
  }

  const hint = !editable
    ? null
    : selected
      ? `Now tap who ${selected.giverName} should swap with.`
      : 'Tap two people to swap who they’re giving to.';

  return (
    <View className="gap-2">
      <View className="gap-1">
        <Text className="font-semibold text-ink-muted text-[15px]">Matches</Text>
        {hint && <Text className="text-footnote text-ink-muted">{hint}</Text>}
      </View>
      <View>
        {assignments.map(row => {
          const isSelected = selected?.giverUserId === row.giverUserId;
          const blocked = !!selected && !isSelected && !!swapProblem(selected, row, exclusions);
          return (
            <Pressable
              key={row.giverUserId}
              onPress={() => press(row)}
              disabled={!editable}
              accessibilityRole={editable ? 'button' : undefined}
              accessibilityLabel={`${row.giverName} gives to ${row.receiverName}`}
              accessibilityHint={editable ? (selected ? 'Swaps their matches' : 'Selects to swap') : undefined}
              accessibilityState={{ selected: isSelected, disabled: !editable }}
              className={cn(
                '-mx-2 flex-row items-center gap-3 rounded-xl px-2 py-2',
                isSelected && 'bg-fill',
                blocked && 'opacity-40',
              )}
            >
              <View className="flex-1 flex-row items-center gap-2">
                <PersonAvatar person={{ name: row.giverName, color: row.giverColor }} />
                <Text>{row.giverName}</Text>
              </View>
              <Icon as={ArrowRight} size={18} className="text-ink-muted" />
              <View className="flex-1 flex-row items-center justify-end gap-2">
                <Text className="text-right">{row.receiverName}</Text>
                <PersonAvatar person={{ name: row.receiverName, color: row.receiverColor }} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
