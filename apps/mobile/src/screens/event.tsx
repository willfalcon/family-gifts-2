import MenuView from '@expo/ui/community/menu';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import { GlassView } from 'expo-glass-effect';
import { ConvexError } from 'convex/values';
import { Link, router, useLocalSearchParams, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, ChevronRight, Ellipsis, MessageCircle, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AskForIdeasSheet from '@/components/ask-for-ideas-sheet';
import { BackButton } from '@/components/back-button';
import GlassButton from '@/components/glass-button';
import SwipeAction from '@/components/swipe-action';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  useEvent,
  useEventAttendees,
  useEventInviteLink,
  useEventInvitees,
  useEventOccasionLists,
  useEventPendingInviteCount,
} from '@/hooks/events';
import { useEventActions } from '@/hooks/event-actions';
import { useSecretSanta } from '@/hooks/secret-santa-setup';
import { useUser } from '@/hooks/user';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { formatWhen, formatShortDate } from '@shared/event-dates';
import { capitalize, plural } from '@shared/utils';
import { format } from 'date-fns';

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
  const pendingCount = useEventPendingInviteCount(eventId);
  const invitees = useEventInvitees(eventId);
  const occasionLists = useEventOccasionLists(eventId);
  const inviteLink = useEventInviteLink(eventId);
  const secretSanta = useSecretSanta(eventId);

  const setAttendeeRole = useMutation(api.events.setAttendeeRole);
  const removeAttendee = useMutation(api.events.removeAttendee);
  const revokeInvite = useMutation(api.events.revokeInvite);
  const transferOwnership = useMutation(api.events.transferOwnership);
  const setMyStatus = useMutation(api.events.setMyStatus);
  const undoDraw = useMutation(api.secretSanta.undoDraw);
  const setSecretSantaOff = useMutation(api.secretSanta.setOff);
  const eventActions = useEventActions(event, exitEvent);
  const cancelled = event?.cancelledAt !== undefined;
  // Who the Ask for ideas sheet is open for, if anyone.
  const [askingUserId, setAskingUserId] = useState<string | null>(null);

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

  function confirmRevoke(inviteId: Id<'eventAttendees'>, name: string) {
    Alert.alert('Revoke invite?', `The invite sent to ${name} will stop working. You can invite them again later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => run(() => revokeInvite({ id: inviteId })) },
    ]);
  }

  function confirmTransfer(attendeeId: Id<'eventAttendees'>, name: string) {
    if (!event) return;
    Alert.alert(`Make ${name} the owner?`, 'You’ll become a host. Only the owner can delete the event.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Transfer', onPress: () => run(() => transferOwnership({ eventId: event._id, attendeeId })) },
    ]);
  }

  function confirmUndoDraw() {
    if (!event || !secretSanta?.exists) return;
    // Before the names are sent nobody knew their match, so nobody is told.
    const sent = secretSanta.status === 'sent';
    Alert.alert(
      'Undo the draw?',
      `Everyone’s match is cleared. Who’s in and the keep-apart rules are kept, so you can draw again.${
        sent ? ' Everyone in the draw gets a notice that their old match no longer counts.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo draw',
          style: 'destructive',
          onPress: () => run(() => undoDraw({ eventId: event._id })),
        },
      ],
    );
  }

  // Secret Santa off. Before anything's set up there's nothing to lose, so
  // it's immediate; a draft setup is thrown away, so ask first.
  function turnOffSecretSanta() {
    if (!event || !secretSanta) return;
    const turnOff = () => run(() => setSecretSantaOff({ eventId: event._id, off: true }));
    if (!secretSanta.exists) {
      turnOff();
      return;
    }
    Alert.alert(
      'Turn off Secret Santa?',
      'Who’s in, the keep-apart rules and the budget will be cleared. You can turn it back on by editing the event.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: turnOff },
      ],
    );
  }

  // The join link: anyone with it can answer Going / Can't go on the web.
  async function copyLink() {
    if (!inviteLink?.url) return;
    await Clipboard.setStringAsync(inviteLink.url);
    Alert.alert('Link copied');
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
    // Invites are host-only on the server.
    ...(isHost && !cancelled ? [{ id: 'invite', title: 'Invite guests' }] : []),
    // Guests only see this while hosts let them share the link.
    ...(inviteLink?.url && !cancelled ? [{ id: 'copy-link', title: 'Copy invite link' }] : []),
    ...(me?.status === 'declined'
      ? [{ id: 'going', title: 'I can go after all' }]
      : me
        ? [{ id: 'cant-go', title: 'Can\u2019t go anymore', attributes: { destructive: true } }]
        : []),
    event?.archived ? { id: 'unarchive', title: 'Unarchive' } : { id: 'archive', title: 'Archive' },
    ...(isHost
      ? [
          cancelled
            ? { id: 'restore', title: 'Restore event' }
            : { id: 'cancel', title: 'Cancel event', attributes: { destructive: true } },
        ]
      : []),
    ...(isOwner ? [{ id: 'delete', title: 'Delete event', attributes: { destructive: true } }] : []),
  ];

  const editHref = {
    pathname: inGroupsTab ? '/(app)/(groups)/events/[id]/edit' : '/(app)/(events)/events/[id]/edit',
    params: { id },
  } as const;
  const inviteHref = {
    pathname: inGroupsTab ? '/(app)/(groups)/events/[id]/invite' : '/(app)/(events)/events/[id]/invite',
    params: { id },
  } as const;
  const secretSantaHref = {
    pathname: inGroupsTab ? '/(app)/(groups)/events/[id]/secret-santa' : '/(app)/(events)/events/[id]/secret-santa',
    params: { id },
  } as const;
  const secretSantaSetupHref = {
    pathname: inGroupsTab
      ? '/(app)/(groups)/events/[id]/secret-santa/setup'
      : '/(app)/(events)/events/[id]/secret-santa/setup',
    params: { id },
  } as const;
  const going = attendees?.filter(a => a.status === 'going') ?? [];

  // Everyone's lists for this event, keyed by owner, so each attendee row can show theirs.
  const listsByOwner = new Map<string, NonNullable<typeof occasionLists>>();
  for (const list of occasionLists ?? []) {
    listsByOwner.set(list.ownerId, [...(listsByOwner.get(list.ownerId) ?? []), list]);
  }
  // Going, by name, then you, then anyone who can't go.
  const rank = (a: NonNullable<typeof attendees>[number]) =>
    a.userId === user?._id ? 1 : a.status === 'declined' ? 2 : 0;
  const sortedAttendees = [...(attendees ?? [])].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
  const listHref = (listId: string) =>
    ({
      pathname: inGroupsTab ? '/(app)/(groups)/lists/[id]' : '/(app)/(events)/lists/[id]',
      params: { id: listId },
    }) as const;

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
                  if (action === 'invite') router.push(inviteHref);
                  else if (action === 'copy-link') copyLink();
                  else if (action === 'cant-go') confirmCantGo();
                  else if (action === 'going' && event) run(() => setMyStatus({ eventId: event._id, status: 'going' }));
                  else if (action === 'archive') eventActions.archive();
                  else if (action === 'unarchive') eventActions.unarchive();
                  else if (action === 'cancel') eventActions.confirmCancel();
                  else if (action === 'restore') eventActions.restore();
                  else if (action === 'delete') eventActions.confirmDelete();
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

        {cancelled && (
          <View className="flex-row items-center gap-3 rounded-xl bg-fill p-3">
            <Text className="flex-1 text-ink-muted">
              This event was cancelled. Its invites and link don’t work until a host restores it.
            </Text>
            {isHost && (
              <Button variant="secondary" size="sm" className="rounded-pill" onPress={eventActions.restore}>
                <Text className="text-accent">Restore</Text>
              </Button>
            )}
          </View>
        )}

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
            <View className="flex-row items-center gap-3">
              <AvatarStack people={going.slice(0, MAX_AVATARS)} />
              <Text className="flex-1 text-[13px] text-ink-muted">
                {going.length} going &middot; {pendingCount ?? 0} waiting
              </Text>
              {isHost && !cancelled && (
                <Link href={inviteHref} asChild>
                  <Button variant="secondary" size="sm" className="rounded-pill">
                    <Icon as={Plus} size={16} strokeWidth={2.5} className="text-accent" />
                    <Text className="text-accent">Invite</Text>
                  </Button>
                </Link>
              )}
            </View>
          </View>
        )}

        {secretSanta && (secretSanta.exists || isHost) && !event?.secretSantaOff && (
          <View className="gap-3">
            <Text className="font-semibold text-ink-muted text-[15px]">Secret Santa</Text>
            {!secretSanta.exists || (isHost && secretSanta.status === 'draft') ? (
              // Until names are drawn, hosts can open the setup to change it
              // (or draw again after an undo), or swipe to turn Secret Santa
              // off; after that the row shows how it's going.
              <SwipeAction label="Turn off" onAction={turnOffSecretSanta}>
                <Link href={secretSantaSetupHref} asChild>
                  <Pressable className="flex-row items-center justify-between gap-2 border-b border-line pb-1">
                    <View className="flex-1 gap-1">
                      <Text className="text-[17px]">
                        {secretSanta.exists ? secretSantaSummary(secretSanta).title : 'Draw names'}
                      </Text>
                      <Text className="text-[13px] text-ink-muted">
                        {secretSanta.exists ? secretSantaSummary(secretSanta).detail : 'Not set up'}
                      </Text>
                    </View>
                    <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                  </Pressable>
                </Link>
              </SwipeAction>
            ) : (
              <View className="flex-row items-center justify-between gap-2 border-b border-line pb-1">
                {(secretSanta.status === 'sent' && secretSanta.myAssignment) ||
                (secretSanta.isManager && secretSanta.mode === 'reviewed') ? (
                  // Once names are sent, anyone in the draw opens the Secret
                  // Santa page to reveal their Match. In a Reviewed draw,
                  // hosts open it to see every Match (and send the names).
                  <Link href={secretSantaHref} asChild>
                    <Pressable className="flex-1 flex-row items-center gap-2">
                      <View className="flex-1 gap-1">
                        <Text className="text-[17px]">{secretSantaSummary(secretSanta).title}</Text>
                        <Text className="text-[13px] text-ink-muted">{secretSantaSummary(secretSanta).detail}</Text>
                      </View>
                      <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                    </Pressable>
                  </Link>
                ) : (
                  <View className="flex-1 gap-1">
                    <Text className="text-[17px]">{secretSantaSummary(secretSanta).title}</Text>
                    <Text className="text-[13px] text-ink-muted">{secretSantaSummary(secretSanta).detail}</Text>
                  </View>
                )}
                {isHost && secretSanta.status !== 'draft' && (
                  <MenuView
                    actions={[{ id: 'undo-draw', title: 'Undo draw', attributes: { destructive: true } }]}
                    onPressAction={e => {
                      if (e.nativeEvent.event === 'undo-draw') confirmUndoDraw();
                    }}
                  >
                    <GlassButton accessibilityLabel="Secret Santa options">
                      <Icon as={Ellipsis} />
                    </GlassButton>
                  </MenuView>
                )}
              </View>
            )}
          </View>
        )}

        {attendees && attendees.length > 0 && (
          <View className="gap-3">
            <Text className="font-semibold text-ink-muted text-[15px]">Attendees &middot; {attendees.length}</Text>
            {sortedAttendees.map(attendee => {
              const isSelf = attendee.userId === user?._id;
              const canManageThem = isHost && !isSelf && attendee.role !== 'owner';
              const actions = [
                attendee.role === 'host'
                  ? { id: 'demote', title: 'Make guest' }
                  : { id: 'promote', title: 'Make host' },
                ...(isOwner && attendee.role === 'host' ? [{ id: 'transfer', title: 'Make owner' }] : []),
                { id: 'remove', title: 'Remove from event', attributes: { destructive: true } },
              ];
              const [firstList, ...moreLists] = listsByOwner.get(attendee.userId) ?? [];
              // Role only when it's not the usual guest, then their list.
              const prefix = [
                attendee.role !== 'guest' && capitalize(attendee.role),
                attendee.status === 'declined' && 'Can’t go',
              ].filter(Boolean);
              const subtitle = [...prefix, firstList ? firstList.title : !isSelf && 'No list yet']
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={attendee.id} className="gap-2">
                  <Pressable
                    className="flex-row items-center gap-2"
                    disabled={!firstList}
                    onPress={() => firstList && router.push(listHref(firstList._id))}
                  >
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
                      {subtitle !== '' && <Text className="text-subhead text-ink-muted">{subtitle}</Text>}
                    </View>
                    {firstList ? (
                      <>
                        <Text className="text-subhead text-ink-muted">{listSummary(firstList, isSelf)}</Text>
                        <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                      </>
                    ) : isSelf ? (
                      !cancelled && (
                        <Link href={{ pathname: '/(app)/(my-lists)/lists/new', params: { eventId: id } }} asChild>
                          <Button variant="secondary" size="sm" className="rounded-pill">
                            <Icon as={Plus} size={16} strokeWidth={2.5} className="text-accent" />
                            <Text className="text-accent">Make a list</Text>
                          </Button>
                        </Link>
                      )
                    ) : (
                      !cancelled &&
                      attendee.userId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-pill"
                          onPress={() => setAskingUserId(attendee.userId ?? null)}
                        >
                          <Icon as={MessageCircle} size={16} strokeWidth={2.5} className="text-accent" />
                          <Text className="text-accent">Ask for ideas</Text>
                        </Button>
                      )
                    )}
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
                  </Pressable>
                  {/* Any further lists they have for this event, tucked under their row. */}
                  {moreLists.map(list => (
                    <Pressable
                      key={list._id}
                      className="ml-12 flex-row items-center gap-2"
                      onPress={() => router.push(listHref(list._id))}
                    >
                      <Text className="flex-1 text-subhead text-ink-muted">{list.title}</Text>
                      <Text className="text-subhead text-ink-muted">{listSummary(list, isSelf)}</Text>
                      <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {invitees && invitees.invitees.length + invitees.withoutAccount > 0 && (
          <View className="gap-3">
            <Text className="font-semibold text-ink-muted text-[15px]">
              Waiting on {invitees.invitees.length + invitees.withoutAccount}
            </Text>
            {invitees.invitees.map(invitee => {
              const label = invitee.name ?? invitee.email ?? '';
              // Hosts see where the invite came from: the group, or else the email it went to.
              const details = invitee.fromGroupName
                ? `From ${invitee.fromGroupName}`
                : invitee.name
                  ? (invitee.email ?? '')
                  : '';
              return (
                <View key={invitee.id} className="flex-row items-center gap-2">
                  <View
                    className="size-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: invitee.color }}
                  >
                    <Text className="text-center text-lg font-semibold text-on-avatar">
                      {label.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="">{label}</Text>
                    {details !== '' && <Text className="text-subhead text-ink-muted">{details}</Text>}
                  </View>
                  {isHost && (
                    <MenuView
                      actions={[{ id: 'revoke', title: 'Revoke invite', attributes: { destructive: true } }]}
                      onPressAction={e => {
                        if (e.nativeEvent.event === 'revoke') confirmRevoke(invitee.id, label);
                      }}
                    >
                      <GlassButton accessibilityLabel={`Options for ${label}`}>
                        <Icon as={Ellipsis} />
                      </GlassButton>
                    </MenuView>
                  )}
                </View>
              );
            })}
            {invitees.withoutAccount > 0 && (
              <Text className="text-ink-muted">
                {invitees.withoutAccount} {invitees.withoutAccount === 1 ? 'person' : 'people'} without an account
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {askingUserId && (
        <AskForIdeasSheet
          visible
          onClose={() => setAskingUserId(null)}
          userId={askingUserId}
          eventId={eventId}
        />
      )}
    </SafeAreaView>
  );
}

const MAX_AVATARS = 4;

// Your own list counts ideas; claims stay hidden from the owner, so others' lists show how much is taken.
function listSummary(list: { itemCount: number; claimedItemCount: number | null }, isMine: boolean) {
  if (isMine) return plural(list.itemCount, 'idea');
  const claimed = list.claimedItemCount ?? 0;
  return claimed === 0 ? `${list.itemCount} open` : `${claimed} of ${list.itemCount} taken`;
}

type SecretSantaState = Extract<NonNullable<ReturnType<typeof useSecretSanta>>, { exists: true }>;

// The Secret Santa row once it's set up: whether names are drawn (the Match
// itself only shows on the Secret Santa page), or when they will be.
function secretSantaSummary(state: SecretSantaState) {
  const budget = state.budget != null ? `$${state.budget} limit` : null;
  const withBudget = (text: string) => (budget ? `${text} · ${budget}` : text);

  const reviewedHost = state.isManager && state.mode === 'reviewed';
  if (state.status === 'drawn') return { title: 'Names drawn', detail: withBudget('Not sent yet') };
  if (state.status === 'sent') {
    if (state.myAssignment) return { title: 'Names drawn', detail: withBudget('Tap to see who you’re giving to') };
    if (reviewedHost) return { title: 'Names sent', detail: withBudget('Tap to see the matches') };
    return { title: 'Names drawn', detail: withBudget('You’re not in the draw') };
  }
  if (state.undone) {
    return state.isManager
      ? { title: 'Draw undone', detail: withBudget('Tap to draw names again') }
      : { title: 'Names being drawn again', detail: withBudget('Your old match no longer counts') };
  }
  const drawError = state.isManager ? state.drawError : null;
  if (drawError) return { title: 'Names not drawn yet', detail: drawError };
  const notified = reviewedHost ? 'Nobody is told until you send the names' : 'Everyone gets a notification';
  if (state.drawAt) {
    return {
      title: `Drawing names ${format(state.drawAt, 'EEE, MMM d')}`,
      detail: withBudget(notified),
    };
  }
  // Nothing scheduled: e.g. a Reviewed draw undone before it was sent.
  if (state.isManager) return { title: 'Names not drawn yet', detail: withBudget('Tap to draw names') };
  return { title: 'Drawing names soon', detail: withBudget('Everyone gets a notification') };
}

// Overlapping avatars for a few of the people going.
function AvatarStack({ people }: { people: { id: string; name: string; color: string }[] }) {
  if (people.length === 0) return null;
  return (
    <View className="flex-row">
      {people.map((person, i) => (
        <View
          key={person.id}
          className="size-7 items-center justify-center rounded-full border-2 border-background"
          style={{ backgroundColor: person.color, marginLeft: i === 0 ? 0 : -8, zIndex: people.length - i }}
        >
          <Text className="text-[12px] font-semibold text-on-avatar">{person.name.charAt(0).toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}
