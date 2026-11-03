import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Share, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { confirm, GuestPicker } from '@/components/guest-picker';
import { FieldRow } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { guestKey, type Guest } from '@/hooks/event-draft';
import { useGroup, useGroupInviteLink, useGroupInvites } from '@/hooks/groups';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

function errorMessage(e: unknown) {
  return e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
}

// Invites people to a group from its page: pick people the viewer already
// knows, or add an email. Picks are sent when tapping Send. Managers also see
// unanswered invites here and can revoke them.
export default function InviteMembers() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const groupId = group?._id;
  const inviteLink = useGroupInviteLink(id);
  const invites = useGroupInvites(id);

  const inviteByEmail = useMutation(api.groups.invite);
  const inviteUser = useMutation(api.groups.inviteUser);
  const revokeInvite = useMutation(api.groups.revokeInvite);
  const resetInviteLink = useMutation(api.groups.resetInviteLink);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);

  const addGuest = (guest: Guest) =>
    setGuests(list => (list.some(g => guestKey(g) === guestKey(guest)) ? list : [...list, guest]));
  const removeGuest = (key: string) => setGuests(list => list.filter(g => guestKey(g) !== key));

  // Members can share an existing link; only managers can create one for
  // older groups that don't have one yet.
  const canShareLink = !!inviteLink && (!!inviteLink.url || inviteLink.canManage);

  async function shareInviteLink() {
    if (!groupId || !inviteLink) return;
    setSharing(true);
    try {
      let url = inviteLink.url;
      if (!url) {
        const ok = await confirm('Create an invite link?', 'Anyone with the link can join the group.', 'Create');
        if (!ok) return;
        url = await resetInviteLink({ groupId });
      }
      // iOS shares a `url` as a proper link; Android ignores `url`, so it goes in `message`.
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch (e) {
      Alert.alert('Couldn’t share the link', errorMessage(e));
    } finally {
      setSharing(false);
    }
  }

  async function send() {
    if (!groupId || guests.length === 0) {
      router.back();
      return;
    }
    setSending(true);
    // Each invite stands alone, so one failing (e.g. already a member) doesn't stop the rest.
    const results = await Promise.allSettled(
      guests.map(guest =>
        guest.kind === 'user'
          ? inviteUser({ groupId, userId: guest.userId })
          : inviteByEmail({ groupId, email: guest.email }),
      ),
    );
    setSending(false);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const messages = [...new Set(failures.map(f => errorMessage(f.reason)))];
      Alert.alert(
        failures.length === results.length ? 'Invites didn’t send' : 'Some invites didn’t send',
        messages.join('\n'),
      );
    }
    router.back();
  }

  async function revoke(inviteId: Id<'groupInvites'>) {
    try {
      await revokeInvite({ id: inviteId });
    } catch (e) {
      Alert.alert('Couldn’t update group', errorMessage(e));
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <View className="w-20" />
        <Text className="flex-1 text-center text-lg font-bold">Invite Members</Text>
        <GlassButton
          className="w-20"
          accessibilityLabel={guests.length > 0 ? 'Send invites' : 'Done'}
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          disabled={sending}
          onPress={send}
        >
          <Text className="font-semibold text-accent-foreground">{guests.length > 0 ? 'Send' : 'Done'}</Text>
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
          target={{ kind: 'group', groupId }}
          guests={guests}
          addGuest={addGuest}
          removeGuest={removeGuest}
          onShareLink={canShareLink ? shareInviteLink : undefined}
          sharing={sharing}
        >
          {invites && invites.length > 0 && (
            <View className="gap-2">
              <Text className="font-semibold text-ink-muted text-[15px]">
                Waiting to hear back &middot; {invites.length}
              </Text>
              {invites.map(invite => (
                <FieldRow key={invite._id}>
                  <Text className="flex-1">{invite.email}</Text>
                  <Button variant="link" className="px-0" onPress={() => revoke(invite._id)}>
                    <Text className="text-destructive font-normal">Revoke</Text>
                  </Button>
                </FieldRow>
              ))}
            </View>
          )}
        </GuestPicker>
      </ScrollView>
    </View>
  );
}
