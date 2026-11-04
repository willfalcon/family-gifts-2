import { Id } from '@convex/_generated/dataModel';
import { useMatchItems } from '@/hooks/secret-santa-setup';
import { useSegments } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import MatchItemRow from './match-item-row';

export default function MatchItems({
  eventId,
  match,
  budget,
}: {
  eventId: Id<'events'> | undefined;
  match: { userId: string; name: string };
  budget: number | null;
}) {
  const data = useMatchItems(eventId);
  const inGroupsTab = useSegments().includes('(groups)');
  if (!data) return null;

  const firstName = match.name.split(' ')[0];
  const { eventList, items } = data;
  const seeAllHref = eventList
    ? ({
        pathname: inGroupsTab ? '/(app)/(groups)/lists/[id]' : '/(app)/(events)/lists/[id]',
        params: { id: eventList._id },
      } as const)
    : ({ pathname: '/(app)/(groups)/people/[id]', params: { id: match.userId } } as const);

  let heading: string;
  let empty: string | null = null;
  if (eventList) {
    heading = `From ${firstName}’s ${eventList.title}`;
    if (items.length === 0) empty = `${firstName} hasn’t added anything yet.`;
  } else if (items.length > 0) {
    heading = `From ${firstName}’s lists`;
  } else {
    heading = `${firstName}’s lists`;
    empty = 'Nothing you can see yet.';
  }

  return (
    <View className="mt-4 gap-3">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 font-semibold text-[15px] text-ink-muted" numberOfLines={1}>
          {heading}
        </Text>
        <Link href={seeAllHref} asChild>
          <Pressable hitSlop={8}>
            <Text className="text-[15px] text-accent">See all</Text>
          </Pressable>
        </Link>
      </View>
      {empty ? (
        <Text className="text-ink-muted">{empty}</Text>
      ) : (
        items.map(item => <MatchItemRow key={item._id} item={item} budget={budget} showList={!eventList} />)
      )}
    </View>
  );
}
