import { BigTitle } from '@/components/big-title';
import GlassButton from '@/components/glass-button';
import ListListItem from '@/components/list-list-item';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLists } from '@/hooks/lists';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Lists() {
  const lists = useLists();

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-row justify-between">
        <BigTitle title="My Lists" />
        <Link href="/lists/new" asChild>
          <GlassButton accessibilityLabel="Add list">
            <Icon as={Plus} size={20} />
          </GlassButton>
        </Link>
      </View>

      {lists && lists.length === 0 ? (
        <Text>Empty</Text>
      ) : (
        <View>{lists && lists.map(list => <ListListItem key={list._id} {...list} />)}</View>
      )}
    </SafeAreaView>
  );
}
