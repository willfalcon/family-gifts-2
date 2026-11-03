import { View } from 'react-native';
import { formatRelativeDay, formatShortDate } from '@shared/event-dates';

import { useMyEventInvites } from '@/hooks/events';
import InviteAnswerButtons, { type MyInvite } from './invite-answer-buttons';
import { Card, CardContent } from './ui/card';
import { Text } from './ui/text';

// One card per pending event invite, shown at the top of the home screen.
export default function InvitationCards() {
  const invites = useMyEventInvites();
  if (!invites?.length) return null;
  return (
    <View className="gap-3">
      {invites.map(invite => (
        <InvitationCard key={invite._id} invite={invite} />
      ))}
    </View>
  );
}

function InvitationCard({ invite }: { invite: MyInvite }) {
  const { event } = invite;
  const from = invite.invitedByName ? `${invite.invitedByName} invited you` : 'You’re invited';
  const when = event.date ? ` · ${formatRelativeDay(event.date)}` : '';

  return (
    <Card>
      <CardContent className="gap-3">
        <View>
          <Text className="text-muted-foreground font-semibold text-sm">
            {from}
            {when}
          </Text>
          <Text className="font-bold text-xl">{event.name}</Text>
          {event.date && <Text>{formatShortDate(event.date, event.startTime)}</Text>}
        </View>
        <InviteAnswerButtons inviteId={invite._id} />
      </CardContent>
    </Card>
  );
}
