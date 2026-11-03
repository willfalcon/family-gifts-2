import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';

import { BigTitle } from '@/components/big-title';
import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { useGroups, useMyGroupInvites } from '@/hooks/groups';
import { Text } from '@/components/ui/text';
import GroupListItem from '@/components/groups/group-list-item';
import { GroupInvitationListItem } from '@/components/group-invitation';

export default function Groups() {
  const groups = useGroups();
  const invites = useMyGroupInvites();

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
      {!!invites?.length && (
        <View className="gap-2 mb-6">
          <Text className="font-semibold text-ink-muted text-[15px]">{`Invitations · ${invites.length}`}</Text>
          {invites.map(invite => (
            <GroupInvitationListItem key={invite._id} invite={invite} />
          ))}
        </View>
      )}
      {groups && groups.length === 0 && !invites?.length ? (
        <Text>Empty</Text>
      ) : (
        <View className="gap-6">{groups && groups.map(group => <GroupListItem key={group._id} {...group} />)}</View>
      )}
    </SafeAreaView>
  );
}
