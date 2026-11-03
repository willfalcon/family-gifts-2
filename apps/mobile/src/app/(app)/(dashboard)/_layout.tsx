import { Stack } from 'expo-router';
import { THEIR_ITEM_SHEET_OPTIONS } from '@/screens/their-item';

export const unstable_settings = { anchor: 'index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="lists/[id]/index" />
      <Stack.Screen name="lists/[id]/items/[itemId]" options={THEIR_ITEM_SHEET_OPTIONS} />
      <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
