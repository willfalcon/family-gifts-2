import { BackLink } from '@/components/back-link';
import GlassButton from '@/components/glass-button';
import { Button } from '@/components/ui/button';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useItems, useList, useListShares } from '@/hooks/lists';
import { Id } from '@convex/_generated/dataModel';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { Ellipsis, Gift, Plus, Star } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function List() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id as Id<'lists'>;

  const list = useList(listId);
  const items = useItems(listId);
  const listShares = useListShares(listId);
  console.log('list', list);
  console.log('listShares', listShares);

  const sharedWithGroups = listShares?.filter(share => share.kind === 'group');

  return (
    <SafeAreaView className="flex-1 gap-6 bg-background p-4">
      <View>
        <View className="flex-row gap-4">
          <View className="flex-0">
            <BackLink />
          </View>
          {list && <Text className="display-detail flex-1">{list.title}</Text>}
          <View className="flex-0">
            <GlassButton accessibilityLabel="Options">
              <Icon as={Ellipsis} />
            </GlassButton>
          </View>
        </View>

        {sharedWithGroups && sharedWithGroups.length > 0 && (
          <View className="ml-12 pl-1">
            <Text>Shared with {sharedWithGroups.map(group => group.name).join(', ')}</Text>
          </View>
        )}
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
        <View>
          {items.map(item => (
            <View key={item._id} className="mb-2 flex-row gap-2">
              {item.imageId && <Image source={{ uri: item.imageId }} />}
              <View className="flex-1 border-b border-line">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg">{item.name}</Text>
                  {item.priority === 'high' && (
                    <View className="flex-row items-center gap-1">
                      <Icon as={Star} className="text-star" size={16} />
                    </View>
                  )}
                </View>
                {(item.notes || item.price) && (
                  <Text>
                    {item.notes && <Text className="text-sm text-ink-muted">{item.notes}</Text>}
                    {item.notes && item.price && <Text className="text-sm text-ink-muted"> • </Text>}
                    {item.price && <Text className="text-sm text-ink-muted">${item.price}</Text>}
                  </Text>
                )}
              </View>
            </View>
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
