import type { FunctionReturnType } from 'convex/server';
import { Link, type Href } from 'expo-router';
import { ChevronRight, Gift } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export type ThreadSummary = FunctionReturnType<typeof api.threads.mine>[number];

// "Dad", "Dad and Sis", "Dad, Sis and Mom".
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function threadHref(id: Id<'threads'>): Href {
  return { pathname: '/(app)/(dashboard)/threads/[id]', params: { id } };
}

// Where "Make a list" goes for an Ask's occasion.
export function makeListHref(ask: { kind: string; eventId: Id<'events'> | null }): Href {
  if (ask.eventId) return { pathname: '/(app)/(my-lists)/lists/new', params: { eventId: ask.eventId } };
  if (ask.kind === 'christmas' || ask.kind === 'birthday') {
    return { pathname: '/(app)/(my-lists)/lists/new', params: { occasion: ask.kind } };
  }
  return '/(app)/(my-lists)/lists/new';
}

// Someone in a Thread. "Your Secret Santa" gets a gift instead of an initial.
export function ThreadAvatar({
  person,
  size = 'sm',
}: {
  person: { name: string; color: string; secretSanta?: boolean } | undefined;
  size?: 'sm' | 'md';
}) {
  return (
    <View
      className={cn('items-center justify-center rounded-full', size === 'md' ? 'size-10' : 'size-8')}
      style={{ backgroundColor: person?.color }}
    >
      {person?.secretSanta ? (
        <Icon as={Gift} size={size === 'md' ? 20 : 16} className="text-on-avatar" />
      ) : (
        <Text className={cn('text-center font-semibold text-on-avatar', size === 'md' && 'text-lg')}>
          {(person?.name ?? '?').charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

// Who a Thread is with. The giver of a Secret Santa Ask sees which Thread
// that is, since their Match doesn't see their name.
export function threadTitle(thread: { others: { name: string }[]; secretSanta: 'giver' | 'match' | null }) {
  const names = joinNames(thread.others.map(o => o.name));
  return thread.secretSanta === 'giver' ? `${names} · Secret Santa` : names;
}

// One Thread in a list: who it's with and its latest message. Bold while
// there's something unread.
export default function ThreadRow({ thread }: { thread: ThreadSummary }) {
  const first = thread.others[0];
  const unread = thread.unreadCount > 0;
  return (
    <Link href={threadHref(thread._id)} asChild>
      <Pressable className="flex-row items-center gap-3 py-1">
        <ThreadAvatar person={first} size="md" />
        <View className="flex-1">
          <Text className={cn(unread && 'font-semibold')}>{threadTitle(thread)}</Text>
          {thread.lastMessage && (
            <Text numberOfLines={1} className={cn('text-subhead text-ink-muted', unread && 'text-ink')}>
              {thread.lastMessage.mine ? 'You: ' : ''}
              {thread.lastMessage.text}
            </Text>
          )}
        </View>
        {unread && <View className="size-2.5 rounded-full bg-accent" accessibilityLabel="Unread" />}
        <Icon as={ChevronRight} size={20} className="text-ink-muted" />
      </Pressable>
    </Link>
  );
}
