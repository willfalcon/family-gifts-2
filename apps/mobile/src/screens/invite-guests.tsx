import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { GuestPicker, useShareInviteLink } from '@/components/guest-picker';
import { FieldRow } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { guestKey, type Guest } from '@/hooks/event-draft';
import { useEvent, useEventInviteLink, useEventInvites } from '@/hooks/events';
import { useGroups } from '@/hooks/groups';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

function errorMessage(e: unknown) {
  return e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
}

// Invites more people to an existing event, from its page. Like Add People in
// the new-event flow, but picks are sent when tapping Send. Also holds the
// invite link settings and the list of unanswered invites. Hosts only.
export default function InviteGuests() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const eventId = event?._id;
  const inviteLink = useEventInviteLink(eventId);
  const invites = useEventInvites(eventId, !!inviteLink?.canManage);
  const groups = useGroups();
  const shareLink = useShareInviteLink();

  const inviteByEmail = useMutation(api.events.invite);
  const inviteUser = useMutation(api.events.inviteUser);
  const inviteGroup = useMutation(api.events.inviteGroup);
  const revokeInvite = useMutation(api.events.revokeInvite);
  const setGuestsCanInvite = useMutation(api.events.setGuestsCanInvite);
  const resetInviteLink = useMutation(api.events.resetInviteLink);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [groupIds, setGroupIds] = useState<Id<'groups'>[]>([]);
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);

  const addGuest = (guest: Guest) =>
    setGuests(list => (list.some(g => guestKey(g) === guestKey(guest)) ? list : [...list, guest]));
  const removeGuest = (key: string) => setGuests(list => list.filter(g => guestKey(g) !== key));
  const pickCount = guests.length + groupIds.length;

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      Alert.alert('Couldn’t update event', errorMessage(e));
    }
  }

  function confirmRevoke(inviteId: Id<'eventAttendees'>, email: string) {
    Alert.alert('Revoke invite?', `The invite sent to ${email} will stop working. You can invite them again later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => run(() => revokeInvite({ id: inviteId })) },
    ]);
  }

  async function shareInviteLink() {
    if (!eventId) return;
    setSharing(true);
    try {
      await shareLink(eventId);
    } finally {
      setSharing(false);
    }
  }

  async function send() {
    if (!eventId || pickCount === 0) {
      router.back();
      return;
    }
    setSending(true);
    // Each invite stands alone, so one failing (e.g. already invited) doesn't stop the rest.
    const results = await Promise.allSettled([
      ...groupIds.map(groupId => inviteGroup({ eventId, groupId })),
      ...guests.map(guest =>
        guest.kind === 'user'
          ? inviteUser({ eventId, userId: guest.userId })
          : inviteByEmail({ eventId, email: guest.email }),
      ),
    ]);
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

  function confirmResetLink() {
    if (!eventId) return;
    Alert.alert('Reset invite link?', 'The current link will stop working. Everyone already on the event stays.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => run(() => resetInviteLink({ eventId })) },
    ]);
  }

  function toggleGroup(groupId: Id<'groups'>) {
    setGroupIds(ids => (ids.includes(groupId) ? ids.filter(g => g !== groupId) : [...ids, groupId]));
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <View className="w-20" />
        <Text className="flex-1 text-center text-lg font-bold">Invite Guests</Text>
        <GlassButton
          className="w-20"
          accessibilityLabel={pickCount > 0 ? 'Send invites' : 'Done'}
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          disabled={sending}
          onPress={send}
        >
          <Text className="font-semibold text-accent-foreground">{pickCount > 0 ? 'Send' : 'Done'}</Text>
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
          target={{ kind: 'event', eventId: eventId }}
          guests={guests}
          addGuest={addGuest}
          removeGuest={removeGuest}
          onShareLink={shareInviteLink}
          sharing={sharing}
        >
          {groups && groups.length > 0 && (
            <View className="gap-0">
              <Text className="font-semibold text-ink-muted text-[15px] mb-2">Groups</Text>
              {groups.map(group => {
                const checked = groupIds.includes(group._id);
                return (
                  <Pressable
                    key={group._id}
                    onPress={() => toggleGroup(group._id)}
                    className="flex-row items-center gap-3 border-b border-line py-2"
                  >
                    <View className="flex-1">
                      <Text>{group.name}</Text>
                      <Text className="text-[13px] text-ink-muted">
                        {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
                      </Text>
                    </View>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleGroup(group._id)}
                      accessibilityLabel={`Invite everyone in ${group.name}`}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {invites && invites.length > 0 && (
            <View className="gap-2">
              <Text className="font-semibold text-ink-muted text-[15px]">
                Waiting to hear back &middot; {invites.length}
              </Text>
              {invites.map(invite => (
                <FieldRow key={invite._id}>
                  <View className="flex-1">
                    <Text>{invite.email}</Text>
                    {invite.sourceGroupName && (
                      <Text className="text-[13px] text-ink-muted">From {invite.sourceGroupName}</Text>
                    )}
                  </View>
                  <Button variant="link" className="px-0" onPress={() => confirmRevoke(invite._id, invite.email)}>
                    <Text className="text-destructive font-normal">Revoke</Text>
                  </Button>
                </FieldRow>
              ))}
            </View>
          )}

          {inviteLink?.canManage && eventId && (
            <View className="gap-2">
              <Text className="font-semibold text-ink-muted text-[15px]">Invite link</Text>
              <FieldRow>
                <Text>Guests can share the link</Text>
                <Switch
                  aria-label="Guests can share the link"
                  checked={inviteLink.guestsCanInvite}
                  onCheckedChange={value => run(() => setGuestsCanInvite({ eventId, guestsCanInvite: value }))}
                />
              </FieldRow>
              {inviteLink.url && (
                <FieldRow>
                  <Button variant="link" className="p-0" onPress={confirmResetLink}>
                    <Text className="text-accent font-normal">Reset invite link</Text>
                  </Button>
                </FieldRow>
              )}
              <Text className="text-[13px] text-ink-muted">
                {inviteLink.guestsCanInvite
                  ? 'Anyone on the event can share the link.'
                  : 'Only hosts can share the link.'}{' '}
                Resetting it stops the old link from working.
              </Text>
            </View>
          )}
        </GuestPicker>
      </ScrollView>
    </View>
  );
}
