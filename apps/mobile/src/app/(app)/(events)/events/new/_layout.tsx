import { Stack } from 'expo-router';

import { EventDraftProvider } from '@/hooks/event-draft';

// The new-event modal is its own small stack so the form and Add People can
// share what's been picked so far.
export default function Layout() {
  return (
    <EventDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="add-people" options={{ presentation: 'modal' }} />
      </Stack>
    </EventDraftProvider>
  );
}
