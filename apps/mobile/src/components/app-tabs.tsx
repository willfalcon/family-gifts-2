import { NativeTabs } from 'expo-router/native-tabs';

import { TabColors } from '../constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={TabColors.background}
      indicatorColor={TabColors.backgroundElement}
      labelStyle={{ selected: { color: TabColors.text } }}
    >
      <NativeTabs.Trigger name="(dashboard)">
        <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house' }} selectedColor={TabColors.accent} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(my-lists)">
        <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>My Lists</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift' }} selectedColor={TabColors.accent} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(groups)">
        <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>People</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2' }} selectedColor={TabColors.accent} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Label selectedStyle={{ color: TabColors.accent }}>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} selectedColor={TabColors.accent} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
