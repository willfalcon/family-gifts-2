import { Stack } from 'expo-router';
import { useUser } from '@/hooks/user';

export default function AppContent() {
  const user = useUser();
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
