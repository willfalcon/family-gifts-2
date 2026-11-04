import { Link, useLocalSearchParams } from 'expo-router';
import { Plus, Gift } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useItemClaims, useItems, useList, useListShares } from '@/hooks/lists';
import { Id } from '@convex/_generated/dataModel';
import EditListMenu from '@/components/edit-list-menu';
import { GlassView } from 'expo-glass-effect';
import ListItem from '@/components/list-item';
import { ListRow, NativeList } from '@/components/native-list';
import { StatusBar } from 'expo-status-bar';
import { occasionParts } from '@/lib/occasion';

export default function MyList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id as Id<'lists'>;

  const list = useList(listId);
  const items = useItems(listId);
  const listShares = useListShares(listId);
  const claims = useItemClaims(listId);

  const sharedWithGroups = listShares?.filter(share => share.kind === 'group');

  return (
    <SafeAreaView className="flex-1 gap-6 bg-background p-4">
      <StatusBar style="light" />
      <View className="gap-2">
        <View className="flex-row items-center gap-4">
          <View className="flex-0">
            <BackButton />
          </View>
          {list && (
            <Text variant="detail" className="flex-1 text-left">
              {list.title}
            </Text>
          )}
          <GlassView
            style={{
              flex: 0,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              height: 36,
            }}
          >
            <Link href={`/lists/${listId}/add-item`} asChild style={{ height: 36 }}>
              <Button variant="ghost" size="icon">
                <Icon as={Plus} className="text-ink" size={17} />
              </Button>
            </Link>
            <EditListMenu listId={listId} archived={list?.archivedAt !== undefined} />
          </GlassView>
        </View>

        <Text className="ml-12 pl-1">
          {list?.occasion && (
            <Text className="text-label text-ink-muted">{occasionParts(list, 'My birthday').join(' · ')}</Text>
          )}
          {list?.occasion && sharedWithGroups && sharedWithGroups.length > 0 && (
            <Text className="text-label text-ink-muted"> · </Text>
          )}
          {sharedWithGroups && sharedWithGroups.length > 0 && (
            <Text className="text-label text-ink-muted">
              Shared with {sharedWithGroups.map(group => group.name).join(', ')}
            </Text>
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
          <Link href={{ pathname: '/(app)/(my-lists)/lists/[id]/add-item', params: { id: listId } }} asChild>
            <Button variant="secondary">
              <Text>Type it in</Text>
            </Button>
          </Link>
        </View>
      )}

      {items && items.length > 0 && (
        <>
          <NativeList>
            {items.map(item => (
              <ListItem
                key={item._id}
                item={item}
                claim={
                  claims ? (claims[item._id] ?? { claimedQuantity: 0, myQuantity: 0, otherClaimers: [] }) : undefined
                }
              />
            ))}
            <ListRow>
              <Link href={{ pathname: '/(app)/(my-lists)/lists/[id]/add-item', params: { id: listId } }} asChild>
                <Button variant="link" className="items-center justify-start">
                  <Icon as={Plus} className="text-accent" />

                  <Text className="text-accent">Add an idea</Text>
                </Button>
              </Link>
            </ListRow>
            <ListRow>
              <Text className="text-ink-muted text-[13px] leading-4 mt-4">
                Tap an idea to edit it, or press and hold for more. You won't see what's been claimed or bought, so
                nothing gets spoiled.
              </Text>
            </ListRow>
          </NativeList>
        </>
      )}
    </SafeAreaView>
  );
}
