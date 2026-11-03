import { Stack } from 'expo-router';
import { useUser } from '@/hooks/user';

export default function AppContent() {
  const user = useUser();

  // Still loading — don't render the stack yet or we'll flash sign-in
  if (user === undefined) return null;

  return (
    <Stack>
      {/* Without redirectTo, expo-router falls back to the first unguarded route
          alphabetically, which is sign-in. */}
      <Stack.Protected guard={!!user} redirectTo="/welcome">
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
