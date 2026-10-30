import type { Doc } from '@convex/_generated/dataModel';
import { formatRelativeDay, formatWhen } from '@shared/event-dates';
import { format, isValid, parseISO } from 'date-fns';
import { Link } from 'expo-router';
import { Calendar, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './ui/icon';
import { Text } from './ui/text';

export default function EventListItem({ event, past = false }: { event: Doc<'events'>; past?: boolean }) {
  // "in 12 days" for upcoming events; past ones just show their date.
  const relative = event.date && !past ? formatRelativeDay(event.date) : null;
  // parseISO reads "YYYY-MM-DD" as local midnight, so the day doesn't shift.
  const parsed = event.date ? parseISO(event.date) : null;
  const start = parsed && isValid(parsed) ? parsed : null;

  return (
    <Link href={{ pathname: '/(app)/(events)/events/[id]', params: { id: event._id } }} asChild>
      <Pressable className="flex-row items-center gap-3 py-1">
        <View className="w-11 items-center justify-center">
          {start ? (
            <>
              <Text className="text-[11px] leading-[13px] font-semibold text-ink-muted">{format(start, 'EEE')}</Text>
              <Text className="text-[22px] leading-[26px] font-semibold text-ink-muted">{format(start, 'd')}</Text>
            </>
          ) : (
            <Icon as={Calendar} size={20} className="text-ink-muted" />
          )}
        </View>
        <View className="flex-1 flex-row items-center justify-between gap-2 border-b border-line pb-3 pt-2">
          <View className="flex-1">
            <Text className={past ? 'text-ink-muted font-semibold' : 'font-semibold'}>{event.name}</Text>
            <Text className="text-ink-muted text-sm">{formatWhen(event)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            {relative && <Text className="text-accent text-sm">{relative}</Text>}
            <Icon as={ChevronRight} size={16} className="text-ink-faint" />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
