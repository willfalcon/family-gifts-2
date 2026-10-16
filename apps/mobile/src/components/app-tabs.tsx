import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { TabColors } from '../constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={TabColors.background}
      indicatorColor={TabColors.backgroundElement}
      labelStyle={{ selected: { color: TabColors.text } }}
    >
      <NativeTabs.Trigger name="(dashboard)">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(lists)">
        <NativeTabs.Trigger.Label>Lists</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(groups)">
        <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
