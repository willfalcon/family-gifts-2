import { Link } from 'expo-router';
import { ChevronDown, ChevronRight, Gift, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigTitle } from '@/components/big-title';
import GlassButton from '@/components/glass-button';
import ListListItem from '@/components/list-list-item';
import { ListRow, NativeList } from '@/components/native-list';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useArchivedLists, useLists } from '@/hooks/lists';
import { Button } from '@/components/ui/button';

export default function MyLists() {
  const lists = useLists();
  const archivedLists = useArchivedLists();
  const [showArchived, setShowArchived] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-row justify-between mb-6">
        <BigTitle title="My Lists" />
        <Link href="/lists/new" asChild>
          <GlassButton accessibilityLabel="Add list">
            <Icon as={Plus} size={20} />
          </GlassButton>
        </Link>
      </View>

      {lists && lists.length === 0 ? (
        <NoLists />
      ) : (
        <NativeList rowSpacing={8}>
          {lists && lists.map(list => <ListListItem key={list._id} {...list} />)}
          <ListRow>
            <Link href="/lists/new" asChild>
              <Pressable className="flex-row items-center gap-2">
                <View className="size-11 items-center justify-center">
                  <Icon as={Plus} size={20} className="text-accent" />
                </View>
                <Text className="text-accent">Add List</Text>
              </Pressable>
            </Link>
          </ListRow>

          {archivedLists && archivedLists.length > 0 && (
            <ListRow>
              <View className="pt-6">
                <Pressable
                  className="flex-row items-center gap-1 py-2"
                  onPress={() => setShowArchived(v => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showArchived }}
                >
                  <Text className="text-ink-muted font-semibold">Archived &middot; {archivedLists.length}</Text>
                  <Icon as={showArchived ? ChevronDown : ChevronRight} size={16} className="text-ink-muted" />
                </Pressable>
              </View>
            </ListRow>
          )}
          {showArchived && archivedLists?.map(list => <ListListItem key={list._id} {...list} archived />)}
        </NativeList>
      )}
    </SafeAreaView>
  );
}

function NoLists() {
  return (
    <View className="flex-1 items-center justify-center gap-4">
      <View className="bg-fill size-16 rounded-2xl items-center justify-center">
        <Icon as={Gift} size={32} className="text-ink-muted" />
      </View>
      <Text className="font-semibold text-xl">Start your first list</Text>
      <Text className="text-ink-muted text-center" pretty>
        Add things you'd love from any store, or just type them in. Share the list with family when you're ready.
      </Text>
      <Link href="/lists/new" asChild className="w-full mt-4">
        <Button size="lg">
          <Text>Create a list</Text>
        </Button>
      </Link>
    </View>
  );
}
