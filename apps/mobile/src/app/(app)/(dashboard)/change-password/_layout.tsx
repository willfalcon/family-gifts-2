import { Stack } from 'expo-router';

// Change Password is a modal with its own stack, so "Forgot it?" can push the
// emailed-code screen inside the modal.
export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
