import { View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { useGroupMembers } from '@/hooks/groups';
import { Group } from '@convex/types';
import { formatRelativeDay } from '@shared/event-dates';
import { Text } from '../ui/text';
import { Icon } from '../ui/icon';
import { plural } from '@shared/utils';

export default function GroupListItem({ _id, name }: Group) {
  const members = useGroupMembers(_id);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-ink-muted">{name}</Text>
        <Link href={`/groups/${_id}`} asChild>
          <Pressable className="flex-row items-center gap-2">
            <Text className="text-accent">{plural(members?.length ?? 0, 'member')}</Text>
            <Icon as={ChevronRight} className="text-accent" />
          </Pressable>
        </Link>
      </View>

      {members && members.length > 0 && (
        <View className="gap-4">
          {members.map(member => {
            const initial = member.name?.charAt(0).toUpperCase() || '?';
            const ideas =
              member.itemCount === 0
                ? 'No ideas shared'
                : member.claimedCount === null
                  ? plural(member.itemCount, 'idea')
                  : `${plural(member.itemCount, 'idea')} · ${member.claimedCount} claimed`;

            return (
              <View key={member.id} className="flex-row items-center gap-2">
                <View
                  className="size-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: member.color }}
                >
                  <Text className="text-white font-bold">{initial}</Text>
                </View>
                <View className="border-b border-line flex-1 py-1">
                  <Text>
                    {member.name}
                    {member.isSelf && <Text className="text-ink-muted"> (you)</Text>}
                  </Text>
                  <Text className="text-sm text-ink-muted">{ideas}</Text>
                  {member.nextOccasion && (
                    <Text className="text-sm text-accent">
                      {member.nextOccasion.label} · {formatRelativeDay(member.nextOccasion.date)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
