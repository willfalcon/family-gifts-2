import { Stack } from 'expo-router';
import { THEIR_ITEM_SHEET_OPTIONS } from '@/screens/their-item';

export const unstable_settings = { anchor: 'events/index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="events/index" />
      <Stack.Screen name="events/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/index" />
      <Stack.Screen name="events/[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lists/[id]/index" />
      <Stack.Screen name="lists/[id]/items/[itemId]" options={THEIR_ITEM_SHEET_OPTIONS} />
    </Stack>
  );
}
