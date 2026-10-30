import MenuView from '@expo/ui/community/menu';
import { GlassView } from 'expo-glass-effect';
import { Gift, Ellipsis } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import ListItem, { type ItemClaim } from '@/components/list-item';
import { NativeList } from '@/components/native-list';
import PrivateIdeaSheet from '@/components/private-idea-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import { useItemClaims, useItems, useList } from '@/hooks/lists';
import { occasionParts } from '@/lib/occasion';
import { Id } from '@convex/_generated/dataModel';

type Filter = 'all' | 'open';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Still open', value: 'open' },
];

const NO_CLAIM: ItemClaim = { claimedQuantity: 0, myQuantity: 0, otherClaimers: [] };

// Someone else's list: browse and claim their ideas. The owner never lands
// here - see screens/list.tsx, which picks this or MyList.
export default function TheirList({ listId }: { listId: Id<'lists'> }) {
  const list = useList(listId);
  const items = useItems(listId);
  const claims = useItemClaims(listId);
  const [filter, setFilter] = useState<Filter>('all');
  const [ideaSheetOpen, setIdeaSheetOpen] = useState(false);

  const ownerName = list?.owner.name;
  const firstName = ownerName?.split(' ')[0];

  // An item is still open while fewer than the wanted quantity are claimed.
  const isOpen = (item: NonNullable<typeof items>[number]) =>
    (claims?.[item._id] ?? NO_CLAIM).claimedQuantity < Math.max(1, item.quantity ?? 1);

  const openItems = items?.filter(isOpen);
  const visibleItems = filter === 'open' ? openItems : items;
  const openCount = openItems?.length;

  const details: string[] = [];
  if (ownerName) details.push(ownerName);
  if (list) details.push(...occasionParts(list, `${firstName ?? 'Their'}'s birthday`));

  return (
    <SafeAreaView className="flex-1 gap-6 bg-background p-4">
      <View className="gap-2">
        <View className="flex-row items-center gap-4">
          <View className="flex-0">
            <BackButton />
          </View>
          <Text variant="detail" className="flex-1 text-left" numberOfLines={1}>
            {list?.title ?? ''}
          </Text>
          <GlassView style={{ flex: 0, borderRadius: 999, flexDirection: 'row', alignItems: 'center', height: 36 }}>
            <MenuView
              actions={[{ id: 'add-private-idea', title: 'Add private idea' }]}
              onPressAction={e => {
                if (e.nativeEvent.event === 'add-private-idea') setIdeaSheetOpen(true);
              }}
            >
              <Button variant="ghost" size="icon" accessibilityLabel="List options">
                <Icon as={Ellipsis} />
              </Button>
            </MenuView>
          </GlassView>
        </View>
        {details.length > 0 && <Text className="ml-12 pl-1 text-label text-ink-muted">{details.join(' · ')}</Text>}
      </View>

      {items && items.length > 0 && (
        <View className="flex-row items-center justify-between">
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
          {openCount !== undefined && (
            <Text className="text-sm text-ink-muted">
              {openCount} of {items.length} still open
            </Text>
          )}
        </View>
      )}

      {items?.length === 0 && (
        <EmptyState title="Nothing here yet" body={`${firstName ?? 'They'} hasn't added any ideas to this list.`} />
      )}

      {visibleItems && visibleItems.length === 0 && items && items.length > 0 && (
        <EmptyState title="Everything's claimed" body="Every idea on this list has been claimed." />
      )}

      {visibleItems && visibleItems.length > 0 && (
        <NativeList>
          {visibleItems.map(item => (
            <ListItem key={item._id} item={item} claim={claims?.[item._id] ?? NO_CLAIM} />
          ))}
        </NativeList>
      )}

      {list && (
        <PrivateIdeaSheet
          visible={ideaSheetOpen}
          onClose={() => setIdeaSheetOpen(false)}
          forUserId={list.owner.userId}
          personName={firstName}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2">
      <View className="mb-2 size-16 items-center justify-center rounded-2xl bg-fill">
        <Icon as={Gift} className="text-ink-muted" size={28} />
      </View>
      <Text className="text-center text-xl font-semibold text-ink">{title}</Text>
      <Text className="mx-4 text-center text-ink-muted">{body}</Text>
    </View>
  );
}
