import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@family-gifts/backend/convex/_generated/api';
import { Gift, Users, Calendar, User as UserIcon, ChevronRight, Sparkles } from 'lucide-react-native';

import { authClient } from '../../../../lib/auth-client';
import { BigTitle } from '@/components/big-title';
import { Link, LinkProps } from 'expo-router';
import Heading from '@/components/heading';
import ListListItem from '@/components/list-list-item';
import GroupListItem from '@/components/group-list-item';
import EventListItem from '@/components/event-list-item';

export default function Index() {
  const lists = useQuery(api.lists.myLists);
  const groups = useQuery(api.groups.myGroups);
  const events = useQuery(api.events.myEvents);

  const isEmpty = lists?.length === 0 && groups?.length === 0 && events?.length === 0;

  return (
    <SafeAreaView className="p-4 gap-6 bg-background flex-1">
      <BigTitle title="Dashboard" subtitle="Everything you're keeping track of, in one place." />
      {isEmpty ? (
        <Text>Empty</Text>
      ) : (
        <>
          {lists && lists.length > 0 && (
            <Section title="Your lists" seeAllTo="/(app)/lists">
              {lists.slice(0, 3).map(list => (
                <ListListItem key={list._id} {...list} />
              ))}
            </Section>
          )}
          {groups && groups.length > 0 && (
            <Section title="Your groups" seeAllTo="/(app)/groups">
              {groups.slice(0, 3).map(group => (
                <GroupListItem key={group._id} {...group} />
              ))}
            </Section>
          )}
          {events && events.length > 0 && (
            <Section title="Your events" seeAllTo="/(app)/events">
              {events.slice(0, 3).map(event => (
                <EventListItem key={event._id} {...event} />
              ))}
            </Section>
          )}
        </>
      )}
      <Text
        onPress={() => {
          // The guard in `RootNavigator` redirects back to the sign-in screen.
          authClient.signOut();
        }}
      >
        Sign Out
      </Text>
    </SafeAreaView>
  );
}

function Section({ title, seeAllTo, children }: { title: string; seeAllTo: LinkProps['href']; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Heading className="text-3xl">{title}</Heading>
        <Link href={seeAllTo} className="text-accent text-sm flex items-center gap-0.5">
          See all <ChevronRight className="size-3.5" />
        </Link>
      </View>
      <View className="flex flex-col gap-1">{children}</View>
    </View>
  );
}
