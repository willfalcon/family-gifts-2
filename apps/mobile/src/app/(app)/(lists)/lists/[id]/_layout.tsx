import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="items/[itemId]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
