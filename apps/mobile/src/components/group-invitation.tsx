import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useMyGroupInvites } from '@/hooks/groups';
import { api } from '@convex/_generated/api';
import { plural } from '@shared/utils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

type MyGroupInvite = FunctionReturnType<typeof api.groups.myInvites>[number];

// "Decline" / "Join" for one of the viewer's pending group invites. Once
// answered, the invite drops out of myInvites, so whatever renders this
// disappears.
function GroupInviteAnswerButtons({ inviteId }: { inviteId: MyGroupInvite['_id'] }) {
  const answer = useMutation(api.groups.answerMyInvite);
  const [busy, setBusy] = useState(false);

  const respond = async (accept: boolean) => {
    setBusy(true);
    try {
      await answer({ id: inviteId, accept });
    } catch (e) {
      const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
      Alert.alert('Couldn’t answer invite', message);
      setBusy(false);
    }
  };

  return (
    <View className="flex-row gap-2">
      <Button className="flex-1" variant="secondary" disabled={busy} onPress={() => respond(false)}>
        <Text>Decline</Text>
      </Button>
      <Button className="flex-1" disabled={busy} onPress={() => respond(true)}>
        <Text>Join</Text>
      </Button>
    </View>
  );
}

// One card per pending group invite, shown at the top of the home screen.
export function GroupInvitationCards() {
  const invites = useMyGroupInvites();
  if (!invites?.length) return null;
  return (
    <View className="gap-3">
      {invites.map(invite => (
        <Card key={invite._id}>
          <CardContent className="gap-3">
            <View>
              <Text className="text-muted-foreground font-semibold text-sm">
                {invite.invitedByName ? `${invite.invitedByName} invited you to a group` : 'You’re invited to a group'}
              </Text>
              <Text className="font-bold text-xl">{invite.group.name}</Text>
              <Text>{plural(invite.group.memberCount, 'member')}</Text>
            </View>
            <GroupInviteAnswerButtons inviteId={invite._id} />
          </CardContent>
        </Card>
      ))}
    </View>
  );
}

// A pending group invite at the top of the People screen. The group can't be
// opened until it's joined, so the answer buttons sit underneath instead of a link.
export function GroupInvitationListItem({ invite }: { invite: MyGroupInvite }) {
  return (
    <View className="flex-row gap-3 py-1">
      <View className="size-10 items-center justify-center rounded-full bg-fill">
        <Icon as={Users} size={20} className="text-ink-muted" />
      </View>
      <View className="flex-1 gap-3 border-b border-line pb-3">
        <View>
          <Text className="font-semibold">{invite.group.name}</Text>
          <Text className="text-ink-muted text-sm">
            {plural(invite.group.memberCount, 'member')}
            {invite.invitedByName ? ` · Invited by ${invite.invitedByName}` : ''}
          </Text>
        </View>
        <GroupInviteAnswerButtons inviteId={invite._id} />
      </View>
    </View>
  );
}
