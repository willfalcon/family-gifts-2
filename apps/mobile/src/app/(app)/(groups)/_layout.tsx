import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'groups/index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="groups/index" />
      <Stack.Screen name="groups/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="groups/[id]/index" />
      <Stack.Screen name="groups/[id]/edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
