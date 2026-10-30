import MenuView from '@expo/ui/community/menu';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import { GlassView } from 'expo-glass-effect';
import { ConvexError } from 'convex/values';
import { Link, router, useLocalSearchParams, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, ChevronRight, Ellipsis, MapPin, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import GlassButton from '@/components/glass-button';
import { FieldRow } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import {
  useEvent,
  useEventAttendees,
  useEventInviteLink,
  useEventInvites,
  useEventOccasionLists,
  useEventPendingInviteCount,
  useEventSharedLists,
} from '@/hooks/events';
import { useGroups } from '@/hooks/groups';
import { useUser } from '@/hooks/user';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { formatWhen, formatShortDate } from '@shared/event-dates';
import { capitalize, plural } from '@shared/utils';

// Shows the server's message for expected failures (ConvexError), a generic one otherwise.
function showError(e: unknown) {
  const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
  Alert.alert('Couldn’t update event', message);
}

export default function Event() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // This screen lives in both the Events and People tabs; links out of it
  // stay in whichever tab it was opened from.
  const inGroupsTab = useSegments().includes('(groups)');

  const event = useEvent(id);
  const eventId = event?._id;
  const user = useUser();
  const attendees = useEventAttendees(eventId);
  const me = attendees?.find(a => a.userId === user?._id);
  const myRole = me?.role;
  const isOwner = myRole === 'owner';
  const isHost = isOwner || myRole === 'host';
  const invites = useEventInvites(eventId, isHost);
  const pendingCount = useEventPendingInviteCount(eventId);
  const lists = useEventSharedLists(eventId);
  const occasionLists = useEventOccasionLists(eventId);
  const inviteLink = useEventInviteLink(eventId);
  const groups = useGroups();

  const setAttendeeRole = useMutation(api.events.setAttendeeRole);
  const removeAttendee = useMutation(api.events.removeAttendee);
  const transferOwnership = useMutation(api.events.transferOwnership);
  const inviteByEmail = useMutation(api.events.invite);
  const inviteGroup = useMutation(api.events.inviteGroup);
  const revokeInvite = useMutation(api.events.revokeInvite);
  const deleteEvent = useMutation(api.events.remove);
  const setMyStatus = useMutation(api.events.setMyStatus);
  const setGuestsCanInvite = useMutation(api.events.setGuestsCanInvite);
  const resetInviteLink = useMutation(api.events.resetInviteLink);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  if (event === null) {
    return (
      <SafeAreaView className="flex-1 gap-6 bg-background p-4">
        <BackButton />
        <Text className="text-center text-ink-muted">This event doesn't exist or you're not attending it.</Text>
      </SafeAreaView>
    );
  }

  function exitEvent() {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(events)/events');
  }

  function confirmDelete() {
    if (!event) return;
    Alert.alert(
      `Delete ${event.name}?`,
      'This removes the event for everyone, along with its invites and Secret Santa. Lists shared with it are kept. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent({ id: event._id });
              exitEvent();
            } catch (e) {
              showError(e);
            }
          },
        },
      ],
    );
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      showError(e);
    }
  }

  function confirmRemove(attendeeId: Id<'eventAttendees'>, name: string) {
    if (!event) return;
    Alert.alert('Remove attendee?', `${name} will be removed from ${event.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => run(() => removeAttendee({ eventId: event._id, attendeeId })),
      },
    ]);
  }

  function confirmTransfer(attendeeId: Id<'eventAttendees'>, name: string) {
    if (!event) return;
    Alert.alert(`Make ${name} the owner?`, 'You’ll become a host. Only the owner can delete the event.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Transfer', onPress: () => run(() => transferOwnership({ eventId: event._id, attendeeId })) },
    ]);
  }

  async function sendInvite() {
    if (!event || !email.trim()) return;
    setSending(true);
    try {
      await inviteByEmail({ eventId: event._id, email });
      setEmail('');
    } catch (e) {
      showError(e);
    } finally {
      setSending(false);
    }
  }

  async function sendGroupInvite(groupId: Id<'groups'>) {
    if (!event) return;
    try {
      const { invited } = await inviteGroup({ eventId: event._id, groupId });
      Alert.alert(
        invited === 0 ? 'Everyone’s already here' : 'Invites sent',
        invited === 0 ? 'Everyone in that group is already attending.' : `Sent ${plural(invited, 'invite')}.`,
      );
    } catch (e) {
      showError(e);
    }
  }

  // Links to the event's web page. Only attendees can open it, so it's for
  // people already invited, not a way to invite someone new.
  // The join link: anyone with it can answer Going / Can't go on the web.
  async function copyLink() {
    if (!inviteLink?.url) return;
    await Clipboard.setStringAsync(inviteLink.url);
    Alert.alert('Link copied');
  }

  function confirmResetLink() {
    if (!event) return;
    Alert.alert('Reset invite link?', 'The current link will stop working. Everyone already on the event stays.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => run(() => resetInviteLink({ eventId: event._id })) },
    ]);
  }

  function confirmCantGo() {
    if (!event) return;
    Alert.alert(
      'Can\u2019t go anymore?',
      'The hosts will see you can\u2019t make it. You can still see the event and change your mind.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Can\u2019t go',
          style: 'destructive',
          onPress: () => run(() => setMyStatus({ eventId: event._id, status: 'declined' })),
        },
      ],
    );
  }

  const menuActions = [
    // Guests only see this while hosts let them share the link.
    ...(inviteLink?.url ? [{ id: 'copy-link', title: 'Copy invite link' }] : []),
    ...(me?.status === 'declined'
      ? [{ id: 'going', title: 'I can go after all' }]
      : me
        ? [{ id: 'cant-go', title: 'Can\u2019t go anymore', attributes: { destructive: true } }]
        : []),
    ...(isOwner ? [{ id: 'delete', title: 'Delete event', attributes: { destructive: true } }] : []),
  ];

  const editHref = {
    pathname: inGroupsTab ? '/(app)/(groups)/events/[id]/edit' : '/(app)/(events)/events/[id]/edit',
    params: { id },
  } as const;

  return (
    // No bottom edge: the scroll view runs behind the tab bar, and iOS insets
    // its content so the last row can still scroll clear of it.
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 p-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <View className="flex-row items-center gap-4">
            <View className="flex-0">
              <BackButton />
            </View>
            <Text variant="detail" className="flex-1 text-left">
              {event?.name}
            </Text>
            {/* Edit and the options menu share one glass pill, like the list screen. */}
            <GlassView style={{ flex: 0, borderRadius: 999, flexDirection: 'row', alignItems: 'center', height: 36 }}>
              {isHost && (
                <Link href={editHref} asChild style={{ height: 36 }}>
                  <Button variant="ghost" size="icon" accessibilityLabel="Edit event">
                    <Icon as={Pencil} className="text-ink" size={17} />
                  </Button>
                </Link>
              )}
              <MenuView
                actions={menuActions}
                onPressAction={e => {
                  const action = e.nativeEvent.event;
                  if (action === 'copy-link') copyLink();
                  else if (action === 'cant-go') confirmCantGo();
                  else if (action === 'going' && event) run(() => setMyStatus({ eventId: event._id, status: 'going' }));
                  else if (action === 'delete') confirmDelete();
                }}
              >
                <Button variant="ghost" size="icon" accessibilityLabel="Event options">
                  <Icon as={Ellipsis} />
                </Button>
              </MenuView>
            </GlassView>
          </View>
          {event && (
            <Text className="ml-12 pl-1 gap-2">
              <Text className="text-ink-muted">
                {event.date ? formatShortDate(event.date, event.startTime) : formatWhen(event)}
              </Text>
              {event.location && <Text className="text-ink-muted"> &middot; {event.location}</Text>}
            </Text>
          )}
        </View>

        {event?.description && <Text>{event.description}</Text>}

        {me?.status === 'going' && attendees && (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <View className="size-6 rounded-full bg-success items-center justify-center">
                <Icon as={Check} size={14} strokeWidth={3} className="text-on-success" />
              </View>
              <Text className="">
                You're going
                {isHost && <Text className=""> &middot; You're hosting</Text>}
              </Text>
            </View>
            <View className="border-b border-line" />
            <Text className="text-[13px] text-ink-muted">
              {attendees.filter(a => a.status === 'going').length} going &middot; waiting on {pendingCount ?? 0}{' '}
              &middot; {attendees.filter(a => a.status === 'declined').length} declined
            </Text>
          </View>
        )}

        {occasionLists && occasionLists.length > 0 && (
          <View className="gap-3">
            <Text className="font-semibold text-ink-muted text-[15px]">Gift lists</Text>
            {occasionLists.map(list => {
              const isMine = list.ownerId === user?._id;
              const color = attendees?.find(a => a.userId === list.ownerId)?.color;
              const claimed = list.claimedItemCount ?? 0;
              const summary = isMine
                ? plural(list.itemCount, 'idea')
                : claimed === 0
                  ? `${list.itemCount} open`
                  : `${claimed} of ${list.itemCount} taken`;
              return (
                <Link
                  key={list._id}
                  href={{
                    pathname: inGroupsTab ? '/(app)/(groups)/lists/[id]' : '/(app)/(events)/lists/[id]',
                    params: { id: list._id },
                  }}
                  asChild
                >
                  <Pressable className="flex-row items-center gap-2">
                    <View
                      className="size-10 rounded-full items-center justify-center bg-muted"
                      style={color ? { backgroundColor: color } : undefined}
                    >
                      <Text className="text-center text-lg font-semibold text-on-avatar">
                        {list.ownerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text>
                        {list.ownerName}
                        {isMine && <Text className="text-ink-muted"> (you)</Text>}
                      </Text>
                      <Text className="text-subhead text-ink-muted">{list.title}</Text>
                    </View>
                    <Text className="text-subhead text-ink-muted">{summary}</Text>
                    <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}

        {attendees && attendees.length > 0 && (
          <View className="gap-3">
            <Text className="font-semibold text-ink-muted text-[15px]">Attendees &middot; {attendees.length}</Text>
            {attendees.map(attendee => {
              const isSelf = attendee.userId === user?._id;
              const canManageThem = isHost && !isSelf && attendee.role !== 'owner';
              const actions = [
                attendee.role === 'host'
                  ? { id: 'demote', title: 'Make guest' }
                  : { id: 'promote', title: 'Make host' },
                ...(isOwner && attendee.role === 'host' ? [{ id: 'transfer', title: 'Make owner' }] : []),
                { id: 'remove', title: 'Remove from event', attributes: { destructive: true } },
              ];
              return (
                <View key={attendee.id} className="flex-row items-center gap-2">
                  <View
                    className="size-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: attendee.color }}
                  >
                    <Text className="text-center text-lg font-semibold text-on-avatar">
                      {attendee.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text>
                      {attendee.name}
                      {isSelf && <Text className="text-ink-muted"> (you)</Text>}
                    </Text>
                    <Text className="text-subhead text-ink-muted">
                      {capitalize(attendee.role)}
                      {attendee.status === 'declined' && ' · Can\u2019t go'}
                    </Text>
                  </View>
                  {canManageThem && (
                    <MenuView
                      actions={actions}
                      onPressAction={e => {
                        if (!event) return;
                        const action = e.nativeEvent.event;
                        if (action === 'promote' || action === 'demote') {
                          const role = action === 'promote' ? 'host' : 'guest';
                          run(() => setAttendeeRole({ eventId: event._id, attendeeId: attendee.id, role }));
                        } else if (action === 'transfer') {
                          confirmTransfer(attendee.id, attendee.name);
                        } else if (action === 'remove') {
                          confirmRemove(attendee.id, attendee.name);
                        }
                      }}
                    >
                      <GlassButton accessibilityLabel={`Options for ${attendee.name}`}>
                        <Icon as={Ellipsis} />
                      </GlassButton>
                    </MenuView>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {isHost && (
          <View className="gap-2">
            <Text className="font-semibold text-ink-muted text-[15px]">Invite</Text>
            <View className="flex-row items-center gap-2">
              <Input
                className="flex-1 mb-0"
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={sendInvite}
              />
              <Button variant="secondary" onPress={sendInvite} disabled={sending || !email.trim()}>
                <Text>Send</Text>
              </Button>
            </View>
            {groups && groups.length > 0 && (
              <MenuView
                actions={groups.map(group => ({ id: group._id, title: group.name }))}
                onPressAction={e => sendGroupInvite(e.nativeEvent.event as Id<'groups'>)}
              >
                <Button variant="link" className="px-0 justify-start">
                  <Text className="text-accent font-normal">Invite a whole group</Text>
                </Button>
              </MenuView>
            )}

            {inviteLink && event && (
              <View className="gap-2 pt-2">
                <FieldRow>
                  <View className="flex-1">
                    <Text>Invite link</Text>
                    <Text className="text-[13px] text-ink-muted">Anyone with the link can join</Text>
                  </View>
                  {inviteLink.url ? (
                    <Button variant="secondary" onPress={copyLink}>
                      <Text>Copy</Text>
                    </Button>
                  ) : (
                    // Events from before links existed have none until a host makes one.
                    <Button variant="secondary" onPress={() => run(() => resetInviteLink({ eventId: event._id }))}>
                      <Text>Create</Text>
                    </Button>
                  )}
                </FieldRow>
                <FieldRow>
                  <Text>Guests can invite</Text>
                  <Switch
                    aria-label="Guests can invite"
                    checked={inviteLink.guestsCanInvite}
                    onCheckedChange={value =>
                      run(() => setGuestsCanInvite({ eventId: event._id, guestsCanInvite: value }))
                    }
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

            {invites && invites.length > 0 && (
              <View className="gap-2 pt-2">
                <Text className="text-[13px] text-ink-muted">Invited</Text>
                {invites.map(invite => (
                  <FieldRow key={invite._id}>
                    <View className="flex-1">
                      <Text>{invite.email}</Text>
                      {invite.sourceGroupName && (
                        <Text className="text-[13px] text-ink-muted">via {invite.sourceGroupName}</Text>
                      )}
                    </View>
                    <Button variant="link" className="px-0" onPress={() => run(() => revokeInvite({ id: invite._id }))}>
                      <Text className="text-destructive font-normal">Revoke</Text>
                    </Button>
                  </FieldRow>
                ))}
              </View>
            )}
          </View>
        )}

        {lists && (
          <View className="gap-2">
            <Text className="font-semibold text-ink-muted text-[15px]">Lists</Text>
            {lists.length === 0 ? (
              <Text className="text-ink-muted">When someone shares a list with this event, it'll show up here.</Text>
            ) : (
              lists.map(list => (
                <Link
                  key={list._id}
                  href={{
                    pathname: inGroupsTab ? '/(app)/(groups)/lists/[id]' : '/(app)/(events)/lists/[id]',
                    params: { id: list._id },
                  }}
                  asChild
                >
                  <Pressable>
                    <FieldRow>
                      <View className="flex-1">
                        <Text>{list.title}</Text>
                        <Text className="text-[13px] text-ink-muted">{list.owner.name}</Text>
                      </View>
                      <Icon as={ChevronRight} size={20} />
                    </FieldRow>
                  </Pressable>
                </Link>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
