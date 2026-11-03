import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Text } from './ui/text';

export type MyInvite = FunctionReturnType<typeof api.events.myInvites>[number];

// "Going" / "Can't go" for one of the viewer's pending invites. Once answered,
// the invite drops out of myInvites, so whatever renders this disappears.
export default function InviteAnswerButtons({
  inviteId,
  className,
}: {
  inviteId: MyInvite['_id'];
  className?: string;
}) {
  const answer = useMutation(api.events.answerMyInvite);
  const [busy, setBusy] = useState(false);

  const respond = async (status: 'going' | 'declined') => {
    setBusy(true);
    try {
      await answer({ id: inviteId, status });
    } catch (e) {
      const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
      Alert.alert('Couldn’t answer invite', message);
      setBusy(false);
    }
  };

  return (
    <View className={cn('flex-row gap-2', className)}>
      <Button className="flex-1" variant="secondary" disabled={busy} onPress={() => respond('declined')}>
        <Text>Can’t go</Text>
      </Button>
      <Button className="flex-1" disabled={busy} onPress={() => respond('going')}>
        <Text>Going</Text>
      </Button>
    </View>
  );
}
