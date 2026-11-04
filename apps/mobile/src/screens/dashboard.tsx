import { Text } from '@/components/ui/text';
import { GlassView } from 'expo-glass-effect';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MenuView } from '@expo/ui/community/menu';

import InvitationCards from '@/components/invitation-card';
import { GroupInvitationCards } from '@/components/group-invitation';
import GiftShoppingCard from '@/components/gift-shopping-card';
import NextUp from '@/components/next-up';
import NoticeCards from '@/components/notice-cards';
import ToDo from '@/components/to-do';
import { useEvents } from '@/hooks/events';
import { useGroups } from '@/hooks/groups';
import { useLists } from '@/hooks/lists';
import { useUser } from '@/hooks/user';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';

export default function DashboardScreen() {
  const lists = useLists();
  const groups = useGroups();
  const events = useEvents();
  const user = useUser();
  const initial = user?.name?.charAt(0).toUpperCase();
  const isEmpty = lists?.length === 0 && groups?.length === 0 && events?.length === 0;
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const firstName = user?.name ? user.name.split(' ')[0] : undefined;
  return (
    <SafeAreaView className="flex-1 gap-6 bg-background p-4">
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-muted-foreground">{today}</Text>
          <Text className="font-display font-display-bold text-3xl">Hi, {firstName}</Text>
        </View>

        <GlassView
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            marginLeft: 'auto',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Link href="/(app)/(dashboard)/profile" asChild>
            <Text className="font-bold">{initial}</Text>
          </Link>
        </GlassView>
      </View>
      <InvitationCards />
      <GroupInvitationCards />
      <NoticeCards />
      <NextUp />
      <GiftShoppingCard />

      <ToDo />
    </SafeAreaView>
  );
}
