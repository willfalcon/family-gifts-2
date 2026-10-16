import { Event } from '@convex/types';
import { Link } from 'expo-router';
import Heading from './heading';
import { View } from 'react-native';
import { Text } from './ui/text';
import { formatWhen } from '@shared/event-dates';

export default function EventListItem(event: Event) {
  return (
    <Link href={`/dashboard/events/${event._id}`} className="border-b pb-4 flex justify-between items-start gap-4">
      <View>
        <Heading>{event.name}</Heading>
        {event.description && <Text className="text-sm text-muted-foreground mt-1">{event.description}</Text>}
      </View>
      <View className="flex items-center gap-1 shrink-0">
        <Text className="text-muted-foreground text-sm text-right">{formatWhen(event)}</Text>
        {/* <FavoriteButton kind="event" id={event._id} /> */}
      </View>
    </Link>
  );
}
