import { BigTitle } from '@/components/big-title';
import ListListItem from '@/components/list-list-item';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateListForm } from '@/components/create-list-form';

export default function Lists() {
  const lists = useQuery(api.lists.myLists);

  return (
    <SafeAreaView className="p-4 bg-background flex-1">
      <BigTitle title="Lists" subtitle="Things you want, organized by occasion." />

      <CreateListForm />

      {lists && lists.length === 0 ? (
        <Text>Empty</Text>
      ) : (
        <View>{lists && lists.map(list => <ListListItem key={list._id} {...list} />)}</View>
      )}
    </SafeAreaView>
  );
}
