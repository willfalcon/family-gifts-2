import { Link } from 'expo-router';
import { Calendar, ChevronDown, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigTitle } from '@/components/big-title';
import EventListItem, { type EventRow } from '@/components/event-list-item';
import InvitationListItem from '@/components/invitation-list-item';
import GlassButton from '@/components/glass-button';
import { ListRow, NativeList } from '@/components/native-list';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { localToday, useEvents, useMyEventInvites } from '@/hooks/events';
import { Button } from '@/components/ui/button';

// Splits already-sorted events into runs by the month they start in, keeping
// their order. Months in the current year are just "October"; other years get
// the year too ("January, 2027"). Undated events go under "No date".
function groupByMonth(events: EventRow[]) {
  const thisYear = new Date().getFullYear();
  const sections: { key: string; title: string; events: EventRow[] }[] = [];
  for (const event of events) {
    const key = event.date?.slice(0, 7) ?? 'none';
    let section = sections.at(-1);
    if (!section || section.key !== key) {
      let title = 'No date';
      if (event.date) {
        const [year, month] = event.date.split('-').map(Number);
        const name = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
        title = year === thisYear ? name : `${name}, ${year}`;
      }
      section = { key, title, events: [] };
      sections.push(section);
    }
    section.events.push(event);
  }
  return sections;
}

function MonthHeading({ children }: { children: string }) {
  return (
    <ListRow>
      <Text className="font-semibold text-ink-muted text-[15px] pt-4">{children}</Text>
    </ListRow>
  );
}

// A tap-to-expand heading, for the Past and Archived sections.
function Disclosure({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <ListRow>
      <View className="pt-6">
        <Pressable
          className="flex-row items-center gap-1 py-2"
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Text className="text-ink-muted font-semibold">{label}</Text>
          <Icon as={open ? ChevronDown : ChevronRight} size={16} className="text-ink-muted" />
        </Pressable>
      </View>
    </ListRow>
  );
}

export default function Events() {
  const events = useEvents();
  const invites = useMyEventInvites();
  const [showPast, setShowPast] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // An event is past once its last day is behind us. Undated events stay in
  // "upcoming" and sort last.
  const today = localToday();
  const sorted = [...(events ?? [])].sort((a, b) => (a.date ?? '￿').localeCompare(b.date ?? '￿'));
  const isPast = (e: (typeof sorted)[number]) => {
    const last = e.endDate ?? e.date;
    return !!last && last < today;
  };
  // Archived events only show in their own section.
  const active = sorted.filter(e => !e.archived);
  const upcoming = active.filter(e => !isPast(e));
  // Most recent first.
  const past = active.filter(isPast).reverse();
  const archived = sorted.filter(e => e.archived).reverse();

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-row justify-between mb-6">
        <BigTitle title="Events" />
        <Link href="/(app)/(events)/events/new" asChild>
          <GlassButton accessibilityLabel="Add event">
            <Icon as={Plus} size={20} />
          </GlassButton>
        </Link>
      </View>

      {events && events.length === 0 && !invites?.length ? (
        <NoEvents />
      ) : (
        <NativeList rowSpacing={8}>
          {!!invites?.length && <MonthHeading>{`Invitations · ${invites.length}`}</MonthHeading>}
          {invites?.map(invite => (
            <ListRow key={invite._id}>
              <InvitationListItem invite={invite} />
            </ListRow>
          ))}

          {groupByMonth(upcoming).flatMap(section => [
            <MonthHeading key={`upcoming-${section.key}`}>{section.title}</MonthHeading>,
            ...section.events.map(event => <EventListItem key={event._id} event={event} />),
          ])}

          <ListRow>
            <Link href="/(app)/(events)/events/new" asChild>
              <Pressable className="flex-row items-center gap-2">
                <View className="size-11 items-center justify-center">
                  <Icon as={Plus} size={20} className="text-accent" />
                </View>
                <Text className="text-accent">Add Event</Text>
              </Pressable>
            </Link>
          </ListRow>

          {past.length > 0 && (
            <Disclosure label={`Past · ${past.length}`} open={showPast} onToggle={() => setShowPast(v => !v)} />
          )}
          {showPast &&
            groupByMonth(past).flatMap(section => [
              <MonthHeading key={`past-${section.key}`}>{section.title}</MonthHeading>,
              ...section.events.map(event => <EventListItem key={event._id} event={event} past />),
            ])}

          {archived.length > 0 && (
            <Disclosure
              label={`Archived · ${archived.length}`}
              open={showArchived}
              onToggle={() => setShowArchived(v => !v)}
            />
          )}
          {showArchived && archived.map(event => <EventListItem key={event._id} event={event} />)}
        </NativeList>
      )}
    </SafeAreaView>
  );
}

function NoEvents() {
  return (
    <View className="flex-1 items-center justify-center gap-4">
      <View className="bg-fill size-16 rounded-2xl items-center justify-center">
        <Icon as={Calendar} size={32} className="text-ink-muted" />
      </View>
      <Text className="font-semibold text-xl">Nothing on the calendar yet</Text>
      <Text className="text-ink-muted text-center">
        Birthdays from your groups show up here on their own. You can also plan a party or a gift exchange and invite
        anyone.
      </Text>
      <Link href="/(app)/(events)/events/new" asChild className="w-full mt-4">
        <Button size="lg">
          <Text>Create an event</Text>
        </Button>
      </Link>
    </View>
  );
}
