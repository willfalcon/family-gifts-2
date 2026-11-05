import { useQuery } from 'convex/react';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { localToday } from '@/hooks/events';
import { api } from '@convex/_generated/api';
import ThreadRow, { joinNames, makeListHref } from './thread-row';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

// The home screen's Messages section. Open Asks to you are grouped by
// occasion, each with its Threads and a way to make the list. Other Threads
// show while they have unread messages. See .scratch/ask-for-ideas/spec.md.
export default function ThreadCards() {
  const home = useQuery(api.threads.home, { today: localToday() });
  if (!home?.hasThreads) return null;
  const { askGroups, santaAsks, threads } = home;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-muted-foreground">Messages</Text>
        <Link href="/(app)/(dashboard)/threads" asChild>
          <Button variant="link" className="px-0">
            <Text className="text-accent font-normal">See all</Text>
          </Button>
        </Link>
      </View>

      {askGroups.map(group => (
        <Card key={group.key}>
          <CardContent className="gap-3">
            <Text className="font-bold text-lg">
              {group.label ? `${group.label} · ` : ''}
              {joinNames(group.askers)} asked for ideas
            </Text>
            <View className="gap-1">
              {group.threads.map(thread => (
                <ThreadRow key={thread._id} thread={thread} />
              ))}
            </View>
            <Link href={makeListHref(group)} asChild>
              <Button variant="secondary" size="sm" className="self-start rounded-pill">
                <Icon as={Plus} size={16} strokeWidth={2.5} className="text-accent" />
                <Text className="text-accent">Make a list</Text>
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}

      {/* Kept apart from other Asks: it's most likely a specific question,
          and answering it shouldn't look like making a list for everyone. */}
      {santaAsks.map(ask => (
        <Card key={ask.key}>
          <CardContent className="gap-3">
            <View>
              <Text className="font-bold text-lg">Your Secret Santa asked for ideas</Text>
              {ask.label && <Text className="text-subhead text-ink-muted">{ask.label}</Text>}
            </View>
            <ThreadRow thread={ask.thread} />
          </CardContent>
        </Card>
      ))}

      {threads.map(thread => (
        <ThreadRow key={thread._id} thread={thread} />
      ))}
    </View>
  );
}
