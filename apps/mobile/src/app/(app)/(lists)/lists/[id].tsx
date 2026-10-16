import { BigTitle } from '@/components/big-title';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '@/components/back-link';

export default function List() {
  const { id } = useLocalSearchParams();
  const listId = Array.isArray(id) ? id[0] : id;
  const list = useQuery(api.lists.get, { id: listId });
  const items = useQuery(api.items.list, { listId });
  const user = useQuery(api.auth.getCurrentUser);
  const isOwner = !!user && user._id === list?.createdBy;
  const count = items?.length;

  return (
    <SafeAreaView className="p-4 bg-background flex-1">
      <BackLink />

      {list ? <BigTitle title={list.title} /> : <Text>??</Text>}
    </SafeAreaView>
  );
}
