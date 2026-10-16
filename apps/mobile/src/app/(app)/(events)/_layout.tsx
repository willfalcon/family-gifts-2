import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'events/index' };

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
