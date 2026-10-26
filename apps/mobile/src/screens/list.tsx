import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { Ellipsis, Gift, Plus, Star } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Host, List as UIList, Section } from '@expo/ui/swift-ui';

import { BackLink } from '@/components/back-link';
import GlassButton from '@/components/glass-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useItems, useList, useListShares } from '@/hooks/lists';
import { Id } from '@convex/_generated/dataModel';
import EditListMenu from '@/components/edit-list-menu';
import { GlassView } from 'expo-glass-effect';
import ListItem from '@/components/list-item';

function formatOccasionDate(isoDate: string) {
  // Parse as local date to avoid UTC-offset surprises on "YYYY-MM-DD" strings.
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function List() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id as Id<'lists'>;

  const list = useList(listId);
  const items = useItems(listId);
  const listShares = useListShares(listId);

  const sharedWithGroups = listShares?.filter(share => share.kind === 'group');

  return (
    <SafeAreaView className="flex-1 gap-6 bg-background">
      <View className="px-4">
        <View className="flex-row items-center gap-4">
          <View className="flex-0">
            <BackLink />
          </View>
          {list && <Text className="display-detail flex-1">{list.title}</Text>}
          <GlassView
            style={{
              flex: 0,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Link href={`/lists/${listId}/add-item`} asChild>
              <Button variant="ghost" size="icon">
                <Icon as={Plus} className="text-ink" size={24} />
              </Button>
            </Link>
            <EditListMenu listId={listId} />
          </GlassView>
        </View>

        <Text className="ml-12 pl-1">
          {list?.occasion &&
            (() => {
              const { occasion } = list;
              const parts: string[] = [];
              if (occasion.kind === 'event') {
                parts.push(list.occasionEventName ?? 'Event');
                if (list.occasionEventDate) parts.push(formatOccasionDate(list.occasionEventDate));
              } else if (occasion.kind === 'christmas') {
                parts.push('Christmas');
              } else if (occasion.kind === 'birthday') {
                parts.push('My birthday');
              } else {
                parts.push(formatOccasionDate(occasion.date));
              }
              return <Text className="text-ink-muted">{parts.join(' · ')}</Text>;
            })()}
          {list?.occasion && sharedWithGroups && sharedWithGroups.length > 0 && (
            <Text className="text-ink-muted"> · </Text>
          )}
          {sharedWithGroups && sharedWithGroups.length > 0 && (
            <Text className="text-ink-muted">Shared with {sharedWithGroups.map(group => group.name).join(', ')}</Text>
          )}
        </Text>
      </View>
      {items?.length === 0 && (
        <View className="flex-1 items-center justify-center gap-2">
          <View className="mb-2 size-16 items-center justify-center rounded-2xl bg-fill">
            <Icon as={Gift} className="text-ink-muted" size={28} />
          </View>
          <Text className="text-center text-xl font-semibold text-ink">Add your first idea</Text>
          <Text className="mx-4 text-center text-ink-muted">
            Paste a link from any store, or just type what you'd like. You can also share to Family Gifts from Safari.
          </Text>
          <Button>
            <Text>Paste a link</Text>
          </Button>
          <Link href={{ pathname: '/(app)/(lists)/lists/[id]/add-item', params: { id: listId } }} asChild>
            <Button variant="secondary">
              <Text>Type it in</Text>
            </Button>
          </Link>
        </View>
      )}

      {items?.length && (
        <View className="flex-1 p-4">
          {items.map(item => (
            <ListItem key={item._id} item={item} />
          ))}
          <Link href={{ pathname: '/(app)/(lists)/lists/[id]/add-item', params: { id: listId } }} asChild>
            <Button variant="link" className="justify-start">
              <View className="h-10 w-10">
                <Icon as={Plus} />
              </View>
              <Text>Add an idea</Text>
            </Button>
          </Link>
        </View>
      )}
    </SafeAreaView>
  );
}
