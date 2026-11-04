import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';

import { BigTitle } from '@/components/big-title';
import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { useGroups, useMyGroupInvites } from '@/hooks/groups';
import { Text } from '@/components/ui/text';
import GroupListItem from '@/components/groups/group-list-item';
import { GroupInvitationListItem } from '@/components/group-invitation';
import { Button } from '@/components/ui/button';

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
        <GroupsEmptyState />
      ) : (
        <View className="gap-6">{groups && groups.map(group => <GroupListItem key={group._id} {...group} />)}</View>
      )}
    </SafeAreaView>
  );
}

function GroupsEmptyState() {
  return (
    <View className="flex-1 items-center justify-center gap-4">
      <View className="bg-fill size-16 rounded-2xl items-center justify-center">
        <Icon as={Users} size={32} className="text-ink-muted" />
      </View>
      <Text className="font-semibold text-xl">Gifts are better together</Text>
      <Text className="text-ink-muted text-center" pretty>
        Make a group for your family or friends and invite them. Everyone shares lists and claims gifts without spoiling
        the surprise.
      </Text>
      <Link href="/groups/new" asChild className="w-full mt-4">
        <Button size="lg">
          <Text>Create a group</Text>
        </Button>
      </Link>
    </View>
  );
}
