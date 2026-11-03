import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { confirm, GuestPicker, useShareInviteLink } from '@/components/guest-picker';
import { Text } from '@/components/ui/text';
import { useEventDraft } from '@/hooks/event-draft';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

// Picks who to invite to a new event. Picks are kept in the event draft and
// only sent when the event form is submitted.
export default function AddPeople() {
  const router = useRouter();
  const draft = useEventDraft();
  const shareLink = useShareInviteLink();
  const [sharing, setSharing] = useState(false);

  if (!draft) return null;

  // The link belongs to the event, so a new event is saved first.
  async function shareInviteLink() {
    if (!draft) return;
    setSharing(true);
    try {
      let eventId: Id<'events'> | undefined = draft.eventId;
      if (!eventId) {
        const ok = await confirm(
          'Create the event first?',
          'An invite link needs the event to exist. It’ll be saved with what you’ve filled in so far, and you can keep editing.',
          'Create',
        );
        if (!ok) return;
        const result = await draft.saveEvent.current?.();
        if (!result) return;
        if ('error' in result) {
          Alert.alert('Can’t create the event yet', result.error);
          return;
        }
        eventId = result.id;
      }
      await shareLink(eventId);
    } finally {
      setSharing(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <View className="w-20" />
        <Text className="flex-1 text-center text-lg font-bold">Add People</Text>
        <GlassButton
          className="w-20"
          accessibilityLabel="Done"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-accent-foreground">Done</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <GuestPicker
          target={{ kind: 'event', eventId: draft.eventId }}
          guests={draft.guests}
          addGuest={draft.addGuest}
          removeGuest={draft.removeGuest}
          onShareLink={shareInviteLink}
          sharing={sharing}
        />
      </ScrollView>
    </View>
  );
}
