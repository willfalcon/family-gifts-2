import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';

import { BigTitle } from '@/components/big-title';
import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { useGroups } from '@/hooks/groups';
import { Text } from '@/components/ui/text';
import GroupListItem from '@/components/groups/group-list-item';

export default function Groups() {
  const groups = useGroups();

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-row justify-between mb-6">
        <BigTitle title="People" />
        <Link href="/groups/new" asChild>
          <GlassButton accessibilityLabel="Add group">
            <Icon as={Plus} size={20} />
          </GlassButton>
        </Link>
      </View>
      {groups && groups.length === 0 ? (
        <Text>Empty</Text>
      ) : (
        <View className="gap-2">{groups && groups.map(group => <GroupListItem key={group._id} {...group} />)}</View>
      )}
    </SafeAreaView>
  );
}
