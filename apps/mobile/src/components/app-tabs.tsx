import { NativeTabs } from 'expo-router/native-tabs';

import { useMyEventInvites } from '@/hooks/events';
import { useMyGroupInvites } from '@/hooks/groups';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { TabBarContext } from '@/hooks/tab-bar';
import { useState } from 'react';
import { TabColors } from '../constants/theme';

export default function AppTabs() {
  // Pending invites show as a count on the Events and People tabs.
  const inviteCount = useMyEventInvites()?.length ?? 0;
  const groupInviteCount = useMyGroupInvites()?.length ?? 0;
  // Unread messages show on the Home tab.
  const unreadCount = useQuery(api.threads.unreadCount) ?? 0;
  // Screens can hide the tab bar while they're open (see useHideTabBar).
  const [tabBarHidden, setTabBarHidden] = useState(false);
  return (
    <TabBarContext.Provider value={setTabBarHidden}>
      <NativeTabs
        hidden={tabBarHidden}
        backgroundColor={TabColors.background}
        indicatorColor={TabColors.backgroundElement}
        badgeBackgroundColor={TabColors.accent}
        badgeTextColor={TabColors.accentForeground}
        labelStyle={{ selected: { color: TabColors.text } }}
      >
        <NativeTabs.Trigger name="(dashboard)">
          <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house' }} selectedColor={TabColors.accent} />
          {/* `hidden` is ignored whenever the badge has text, so pass none at zero. */}
          <NativeTabs.Trigger.Badge hidden={unreadCount === 0}>
            {unreadCount > 0 ? String(unreadCount) : undefined}
          </NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(my-lists)">
          <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>My Lists</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift' }} selectedColor={TabColors.accent} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(groups)">
          <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>People</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.2', selected: 'person.2' }}
            selectedColor={TabColors.accent}
          />
          {/* `hidden` is ignored whenever the badge has text, so pass none at zero. */}
          <NativeTabs.Trigger.Badge hidden={groupInviteCount === 0}>
            {groupInviteCount > 0 ? String(groupInviteCount) : undefined}
          </NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(events)">
          <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>Events</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'calendar', selected: 'calendar' }}
            selectedColor={TabColors.accent}
          />
          {/* `hidden` is ignored whenever the badge has text, so pass none at zero. */}
          <NativeTabs.Trigger.Badge hidden={inviteCount === 0}>
            {inviteCount > 0 ? String(inviteCount) : undefined}
          </NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabBarContext.Provider>
  );
}
