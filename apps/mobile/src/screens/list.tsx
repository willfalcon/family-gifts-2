import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Text } from '@/components/ui/text';
import { useList } from '@/hooks/lists';
import MyList from '@/screens/my-list';
import TheirList from '@/screens/their-list';
import { Id } from '@convex/_generated/dataModel';

// A list opened from a group, event, person, or the dashboard - it could be
// yours or someone else's, so pick the matching screen.
export default function List() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id as Id<'lists'>;
  const list = useList(listId);

  if (list === undefined) return <View className="flex-1 bg-background" />;
  if (list === null) {
    return (
      <SafeAreaView className="flex-1 gap-6 bg-background p-4">
        <BackButton />
        <Text className="text-center text-ink-muted">This list doesn't exist or isn't shared with you.</Text>
      </SafeAreaView>
    );
  }
  return list.isMine ? <MyList /> : <TheirList listId={listId} />;
}
