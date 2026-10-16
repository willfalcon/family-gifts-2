import { api } from '@family-gifts/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { Stack } from 'expo-router';

export default function AppContent() {
  const user = useQuery(api.auth.getCurrentUser);
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
