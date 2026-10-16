import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'lists/index' };

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
