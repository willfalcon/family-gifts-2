import { useLocalSearchParams } from 'expo-router';

import EventForm from '@/components/event-form';

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventForm id={id} />;
}
