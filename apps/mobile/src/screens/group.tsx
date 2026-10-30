import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text } from '@/components/ui/text';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { BackLink } from '@/components/back-link';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useGroup, useGroupEvents, useGroupInviteLink, useGroupInvites, useGroupMembers } from '@/hooks/groups';
import { Icon } from '@/components/ui/icon';
import GlassButton from '@/components/glass-button';
import { ChevronRight, Ellipsis, Pencil } from 'lucide-react-native';
import { capitalize, plural } from '@shared/utils';
import MenuView from '@expo/ui/community/menu';
import { Button } from '@/components/ui/button';
import { FieldRow } from '@/components/profile-form';
import { Switch } from '@/components/ui/switch';

// Event dates are "YYYY-MM-DD"; parsed as local dates so they don't shift a day.
function formatEventDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const eventStatusLabel = {
  attending: 'Attending',
  invited: 'Invited',
  notInvited: 'Not invited',
} as const;

export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const group = useGroup(id);

  const members = useGroupMembers(id);
  const invites = useGroupInvites(id);
  const inviteLink = useGroupInviteLink(id);
  const events = useGroupEvents(id);
  console.log('events', events);
  const isManager = inviteLink?.canManage ?? false;
  const membersCanInvite = inviteLink?.membersCanInvite ?? false;

  const setMemberRole = useMutation(api.groups.setMemberRole);
  const removeMember = useMutation(api.groups.removeMember);
  const setMembersCanInviteMutation = useMutation(api.groups.setMembersCanInvite);
  const resetInviteLink = useMutation(api.groups.resetInviteLink);
  const leaveGroup = useMutation(api.groups.leave);
  const deleteGroup = useMutation(api.groups.remove);

  // A manager can only leave if someone else can still manage the group (the
  // server enforces this too).
  const hasOtherManager =
    members?.some(member => !member.isSelf && (member.role === 'manager' || member.role === 'owner')) ?? false;
  const canLeave = !isManager || hasOtherManager;

  // Shows the server's message for expected failures (ConvexError), a generic one otherwise.
  function showError(e: unknown) {
    const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
    Alert.alert('Couldn\u2019t update group', message);
  }

  async function changeRole(memberId: Id<'groupMembers'>, role: 'manager' | 'member') {
    if (!group) return;
    try {
      await setMemberRole({ groupId: group._id, memberId, role });
    } catch (e) {
      showError(e);
    }
  }

  // Leaving or deleting makes this screen's queries go empty, so head back to
  // the groups list.
  function exitGroup() {
    if (router.canGoBack()) router.back();
    else router.replace('/groups');
  }

  function confirmLeave() {
    if (!group) return;
    Alert.alert(`Leave ${group.name}?`, 'Your lists will no longer be shared with this group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup({ groupId: group._id });
            exitGroup();
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);
  }

  function confirmDelete() {
    if (!group) return;
    Alert.alert(
      `Delete ${group.name}?`,
      'This removes the group for everyone, along with its members and pending invites. This can\u2019t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup({ id: group._id });
              exitGroup();
            } catch (e) {
              showError(e);
            }
          },
        },
      ],
    );
  }

  function confirmRemove(memberId: Id<'groupMembers'>, name: string) {
    if (!group) return;
    Alert.alert('Remove member?', `${name} will be removed from ${group.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember({ groupId: group._id, memberId });
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);
  }

  // iOS shares a `url` as a proper link (with Copy in the sheet); Android
  // ignores `url`, so it goes in `message` there.
  async function shareInviteLink() {
    if (!inviteLink?.url) return;
    await Share.share(Platform.OS === 'ios' ? { url: inviteLink.url } : { message: inviteLink.url });
  }

  // Older groups have no link until a manager makes one; same mutation as reset.
  async function createInviteLink() {
    if (!group) return;
    try {
      await resetInviteLink({ groupId: group._id });
    } catch (e) {
      showError(e);
    }
  }

  function confirmResetInviteLink() {
    if (!group) return;
    Alert.alert('Reset invite link?', 'The current link will stop working. Everyone already in the group stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetInviteLink({ groupId: group._id });
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);
  }

  async function setMembersCanInvite(value: boolean) {
    if (!group) return;
    try {
      await setMembersCanInviteMutation({ groupId: group._id, membersCanInvite: value });
    } catch (e) {
      showError(e);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="light" />
      <ScrollView className="flex-1" contentContainerClassName="gap-8 p-4 pb-8">
        <View className="gap-2">
          <View className="flex-row items-center gap-4">
            <View className="flex-0">
              <BackLink />
            </View>
            {group && (
              <Text variant="detail" className="flex-1 text-left">
                {group.name}
              </Text>
            )}

            {isManager && (
              <Link href={`/groups/${id}/edit`} asChild style={{ height: 36 }}>
                <GlassButton accessibilityLabel="Edit group">
                  <Icon as={Pencil} className="text-ink" size={17} />
                </GlassButton>
              </Link>
            )}
          </View>
          <Text className="ml-12 pl-1">
            {members && members.length > 0 && (
              <Text className="text-label text-ink-muted">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Text>
            )}
          </Text>
        </View>

        {invites && invites.length > 0 && (
          <View className="gap-2">
            <Text className="text-label text-ink-muted">Pending invites</Text>
            {invites.map(invite => (
              <Text key={invite._id}>{invite.email}</Text>
            ))}
          </View>
        )}

        {members && members.length > 0 && (
          <View className="gap-2">
            <Text className="text-label font-semibold text-ink-muted">Members</Text>
            {members.map(member => {
              const initial = member.name.charAt(0).toUpperCase();
              const ideas =
                member.itemCount === 0
                  ? 'No ideas shared'
                  : member.isSelf || member.claimedCount === null
                    ? plural(member.itemCount, 'idea')
                    : `${plural(member.itemCount, 'idea')} · ${member.claimedCount} claimed`;

              const memberIsManager = member.role === 'manager';
              const actions = memberIsManager
                ? [
                    { id: 'demote', title: 'Demote to member' },
                    { id: 'remove', title: 'Remove from group', attributes: { destructive: true } },
                  ]
                : [
                    { id: 'promote', title: 'Promote to manager' },
                    { id: 'remove', title: 'Remove from group', attributes: { destructive: true } },
                  ];
              return (
                <View key={member.id} className="flex-row gap-2">
                  <View
                    className="size-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: member.color }}
                  >
                    <Text className="text-center text-lg font-semibold text-on-avatar">{initial}</Text>
                  </View>
                  <View className="flex-1">
                    <Text>
                      {member.name}
                      {member.isSelf && <Text className="text-ink-muted"> (you)</Text>}
                    </Text>

                    <Text className="text-subhead text-ink-muted">
                      {capitalize(member.role)} · {ideas}
                    </Text>
                  </View>
                  {isManager && !member.isSelf && member.role !== 'owner' && (
                    <MenuView
                      actions={actions}
                      onPressAction={e => {
                        const action = e.nativeEvent.event;
                        if (action === 'promote') {
                          changeRole(member.id, 'manager');
                        } else if (action === 'demote') {
                          changeRole(member.id, 'member');
                        } else if (action === 'remove') {
                          confirmRemove(member.id, member.name);
                        }
                      }}
                    >
                      <GlassButton accessibilityLabel="Member options">
                        <Icon as={Ellipsis} />
                      </GlassButton>
                    </MenuView>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {events && events.length > 0 && (
          <View className="gap-2">
            <Text className="text-label font-semibold text-ink-muted">Events</Text>
            {events.map(event => (
              <View key={event.id}>
                <Text>{event.name}</Text>
                <Text className="text-subhead text-ink-muted">
                  {event.date
                    ? `${formatEventDate(event.date)}${event.endDate ? ` – ${formatEventDate(event.endDate)}` : ''} · `
                    : ''}
                  {eventStatusLabel[event.status]}
                </Text>
              </View>
            ))}
            <Text className="text-[13px] text-ink-muted">
              Managers can add or remove people and change these settings. They can't see claims on anyone's list, or
              lists that aren't shared with the group.
            </Text>
          </View>
        )}

        {inviteLink && (
          <View className="gap-2">
            <Text className="font-semibold text-ink-muted text-[15px]">Joining</Text>
            {(inviteLink.url || isManager) && (
              <FieldRow>
                <View className="">
                  <Text>Invite Link</Text>
                  <Text className="text-[13px] text-ink-muted">Anyone with the link joins right away</Text>
                </View>
                {inviteLink.url ? (
                  <Button variant="secondary" onPress={shareInviteLink}>
                    <Text>Share</Text>
                  </Button>
                ) : (
                  <Button variant="secondary" onPress={createInviteLink}>
                    <Text>Create</Text>
                  </Button>
                )}
              </FieldRow>
            )}
            {isManager && (
              <>
                <FieldRow>
                  <Text>Members can invite</Text>
                  <Switch checked={membersCanInvite} onCheckedChange={setMembersCanInvite} />
                </FieldRow>
                {inviteLink.url && (
                  <FieldRow>
                    <Button variant="link" className="p-0" onPress={confirmResetInviteLink}>
                      <Text className="text-accent font-normal">Reset invite link</Text>
                    </Button>
                  </FieldRow>
                )}
              </>
            )}
            <Text className="text-[13px] text-ink-muted">
              {!isManager
                ? membersCanInvite
                  ? 'Anyone in the group can share the link.'
                  : 'Only managers can share the invite link.'
                : membersCanInvite
                  ? 'Anyone in the group can share the link. Resetting it stops the old link from working. Everyone already here stays.'
                  : 'Only managers can share the link. Resetting it stops the old link from working. Everyone already here stays.'}
            </Text>
          </View>
        )}

        {events && events.length > 0 && (
          <View className="gap-2">
            <Text className="font-semibold text-ink-muted text-[15px]">Events</Text>
            {events?.map(event => (
              <FieldRow key={event.id}>
                <Link href={`/(app)/(groups)/events/${event.id}`} asChild>
                  <Pressable className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text>{event.name}</Text>
                      {event.date && <Text className="text-[13px] text-ink-muted">{formatEventDate(event.date)}</Text>}
                    </View>
                    <Icon as={ChevronRight} size={20} />
                  </Pressable>
                </Link>
              </FieldRow>
            ))}
          </View>
        )}

        <View className="gap-2">
          <Text className="font-semibold text-ink-muted text-[15px]">Notifications</Text>
          {/* TODO: Notification settings */}
          <FieldRow>
            <Text>Mute this group</Text>
            <Switch checked={false} onCheckedChange={() => {}} />
          </FieldRow>
        </View>

        {group && (
          <View className="gap-4">
            <View className="gap-2">
              <Button variant="secondary" onPress={confirmLeave} disabled={!canLeave}>
                <Text>Leave group</Text>
              </Button>
              {!canLeave && (
                <Text className="text-[13px] text-ink-muted">
                  You&apos;re the only manager. Make someone else a manager before you leave.
                </Text>
              )}
            </View>
            {isManager && (
              <Button variant="destructive" onPress={confirmDelete}>
                <Text>Delete group</Text>
              </Button>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
