import { Stack } from 'expo-router';
import { useUser } from '@/hooks/user';

export default function AppContent() {
  const user = useUser();

  // Still loading — don't render the stack yet or we'll flash sign-in
  if (user === undefined) return null;

  return (
    <Stack>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
