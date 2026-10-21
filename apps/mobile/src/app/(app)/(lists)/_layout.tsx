import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'lists/index' };

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="lists/index" />
      <Stack.Screen name="lists/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
