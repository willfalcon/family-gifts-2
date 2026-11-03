import { formatRelativeDay, formatWhen } from '@shared/event-dates';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { View } from 'react-native';

import InviteAnswerButtons, { type MyInvite } from './invite-answer-buttons';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

// A pending invite on the Events screen, laid out like EventListItem but with
// the answer buttons underneath instead of a link (the event can't be opened
// until it's answered).
export default function InvitationListItem({ invite }: { invite: MyInvite }) {
  const { event } = invite;
  const relative = event.date ? formatRelativeDay(event.date) : null;
  const parsed = event.date ? parseISO(event.date) : null;
  const start = parsed && isValid(parsed) ? parsed : null;

  return (
    <View className="flex-row gap-3 py-1">
      <View className="w-11 items-center pt-2">
        {start ? (
          <>
            <Text className="text-[11px] leading-[13px] font-semibold text-ink-muted">{format(start, 'EEE')}</Text>
            <Text className="text-[22px] leading-[26px] font-semibold text-ink-muted">{format(start, 'd')}</Text>
          </>
        ) : (
          <Icon as={Calendar} size={20} className="text-ink-muted" />
        )}
      </View>
      <View className="flex-1 gap-3 border-b border-line pb-3 pt-2">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Text className="font-semibold">{event.name}</Text>
            <Text className="text-ink-muted text-sm">{formatWhen(event)}</Text>
            {invite.invitedByName && (
              <Text className="text-ink-muted text-sm">Invited by {invite.invitedByName}</Text>
            )}
          </View>
          {relative && <Text className="text-accent text-sm">{relative}</Text>}
        </View>
        <InviteAnswerButtons inviteId={invite._id} />
      </View>
    </View>
  );
}
