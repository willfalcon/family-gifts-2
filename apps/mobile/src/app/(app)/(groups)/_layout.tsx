import { Stack } from 'expo-router';
import { THEIR_ITEM_SHEET_OPTIONS } from '@/screens/their-item';

export const unstable_settings = { anchor: 'groups/index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="groups/index" />
      <Stack.Screen name="groups/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="groups/[id]/index" />
      <Stack.Screen name="groups/[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="groups/[id]/invite" options={{ presentation: 'modal' }} />
      <Stack.Screen name="people/[id]" />
      <Stack.Screen name="events/[id]/index" />
      <Stack.Screen name="events/[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/invite" options={{ presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/secret-santa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lists/[id]/index" />
      <Stack.Screen name="lists/[id]/items/[itemId]" options={THEIR_ITEM_SHEET_OPTIONS} />
    </Stack>
  );
}
