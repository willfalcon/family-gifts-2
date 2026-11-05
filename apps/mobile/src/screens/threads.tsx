import { useQuery } from 'convex/react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import ThreadRow from '@/components/thread-row';
import { Text } from '@/components/ui/text';
import { localToday } from '@/hooks/events';
import { api } from '@convex/_generated/api';

// Every Thread you're in, newest first.
export default function Threads() {
  const threads = useQuery(api.threads.mine, { today: localToday() });
  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="mb-6 flex-row items-center gap-2">
        <BackButton />
        <Text variant="detail" className="mt-1 flex-1 text-left">
          Messages
        </Text>
      </View>
      <ScrollView contentContainerClassName="gap-2 pb-8">
        {threads?.length === 0 && <Text className="text-ink-muted">No messages yet.</Text>}
        {threads?.map(thread => (
          <ThreadRow key={thread._id} thread={thread} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
