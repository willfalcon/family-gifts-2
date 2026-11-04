import { useEvents } from '@/hooks/events';
import { formatRelativeDay } from '@shared/event-dates';
import { Card, CardContent } from './ui/card';
import { Text } from './ui/text';

export default function NextUp() {
  const events = useEvents();

  const nextEvent = events?.find(e => e.cancelledAt === undefined) ?? null;

  const when = nextEvent?.date ? formatRelativeDay(nextEvent.date) : undefined;
  const date =
    nextEvent?.date &&
    new Date(nextEvent.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  return (
    <Card>
      <CardContent>
        <Text className="text-muted-foreground font-semibold text-sm">Next up &middot; {when}</Text>
        <Text className="font-bold text-xl">{nextEvent?.name}</Text>
        <Text>{date}</Text>
      </CardContent>
    </Card>
  );
}
