import { Link } from 'expo-router';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigTitle } from '@/components/big-title';
import EventListItem from '@/components/event-list-item';
import InvitationListItem from '@/components/invitation-list-item';
import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { localToday, useEvents, useMyEventInvites } from '@/hooks/events';
import type { Doc } from '@convex/_generated/dataModel';

type EventDoc = Doc<'events'>;

// Splits already-sorted events into runs by the month they start in, keeping
// their order. Months in the current year are just "October"; other years get
// the year too ("January, 2027"). Undated events go under "No date".
function groupByMonth(events: EventDoc[]) {
  const thisYear = new Date().getFullYear();
  const sections: { key: string; title: string; events: EventDoc[] }[] = [];
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
  return <Text className="font-semibold text-ink-muted text-[15px] pt-4">{children}</Text>;
}

export default function Events() {
  const events = useEvents();
  const invites = useMyEventInvites();
  const [showPast, setShowPast] = useState(false);

  // An event is past once its last day is behind us. Undated events stay in
  // "upcoming" and sort last.
  const today = localToday();
  const sorted = [...(events ?? [])].sort((a, b) => (a.date ?? '￿').localeCompare(b.date ?? '￿'));
  const isPast = (e: (typeof sorted)[number]) => {
    const last = e.endDate ?? e.date;
    return !!last && last < today;
  };
  const upcoming = sorted.filter(e => !isPast(e));
  // Most recent first.
  const past = sorted.filter(isPast).reverse();

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
        <View className="gap-2 pt-8 items-center">
          <Text className="font-semibold text-lg">No events yet</Text>
          <Text className="text-ink-muted text-center">
            Add a birthday, holiday, or party, then invite people and share lists with it.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-2 pb-8">
          {!!invites?.length && (
            <View className="gap-2">
              <MonthHeading>{`Invitations · ${invites.length}`}</MonthHeading>
              {invites.map(invite => (
                <InvitationListItem key={invite._id} invite={invite} />
              ))}
            </View>
          )}

          {groupByMonth(upcoming).map(section => (
            <View key={section.key} className="gap-2">
              <MonthHeading>{section.title}</MonthHeading>
              {section.events.map(event => (
                <EventListItem key={event._id} event={event} />
              ))}
            </View>
          ))}

          <Link href="/(app)/(events)/events/new" asChild>
            <Pressable className="flex-row items-center gap-2">
              <View className="size-11 items-center justify-center">
                <Icon as={Plus} size={20} className="text-accent" />
              </View>
              <Text className="text-accent">Add Event</Text>
            </Pressable>
          </Link>

          {past.length > 0 && (
            <View className="pt-6">
              <Pressable
                className="flex-row items-center gap-1 py-2"
                onPress={() => setShowPast(v => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showPast }}
              >
                <Text className="text-ink-muted font-semibold">Past &middot; {past.length}</Text>
                <Icon as={showPast ? ChevronDown : ChevronRight} size={16} className="text-ink-muted" />
              </Pressable>
            </View>
          )}
          {showPast &&
            groupByMonth(past).map(section => (
              <View key={section.key} className="gap-2">
                <MonthHeading>{section.title}</MonthHeading>
                {section.events.map(event => (
                  <EventListItem key={event._id} event={event} past />
                ))}
              </View>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
