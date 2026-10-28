import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'lists/index' };

// All list routes live in one flat stack so modals (e.g. edit) can be
// presented over whichever screen pushed them — the lists page or a list's page.
export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="lists/index" />
      <Stack.Screen name="lists/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lists/[id]/index" />
      <Stack.Screen name="lists/[id]/add-item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lists/[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lists/[id]/items/[itemId]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
