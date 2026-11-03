import { Stack, useLocalSearchParams } from 'expo-router';

import { useEvent } from '@/hooks/events';
import { SecretSantaSetupProvider } from '@/hooks/secret-santa-setup';

// The Secret Santa modal is its own small stack so the setup sheet and Keep
// Apart can share what's been picked so far.
export default function Layout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  return (
    <SecretSantaSetupProvider eventId={event?._id}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="keep-apart" options={{ presentation: 'modal' }} />
      </Stack>
    </SecretSantaSetupProvider>
  );
}
