import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="lists/[id]" />
      <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
