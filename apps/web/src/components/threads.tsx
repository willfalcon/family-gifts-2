import { Link } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { ChevronRight } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Avatar } from '@/components/avatar';
import { cn, joinNames } from '@/lib/utils';

export type ThreadSummary = FunctionReturnType<typeof api.threads.mine>[number];

export type NewListSearch = { eventId?: string; occasion?: 'birthday' | 'christmas' };

// Where "Make a list" goes for an Ask's occasion.
export function makeListSearch(ask: { kind: string; eventId: Id<'events'> | null }): NewListSearch {
  if (ask.eventId) return { eventId: ask.eventId };
  if (ask.kind === 'christmas' || ask.kind === 'birthday') return { occasion: ask.kind };
  return {};
}

// Who a Thread is with. The giver of a Secret Santa Ask sees which Thread
// that is, since their Match doesn't see their name.
export function threadTitle(thread: { others: { name: string }[]; secretSanta: 'giver' | 'match' | null }) {
  const names = joinNames(thread.others.map(o => o.name));
  return thread.secretSanta === 'giver' ? `${names} · Secret Santa` : names;
}

// One Thread in a list: who it's with and its latest message. Bold while
// there's something unread.
export function ThreadRow({ thread }: { thread: ThreadSummary }) {
  const first = thread.others[0];
  const unread = thread.unreadCount > 0;
  return (
    <Link
      to="/messages/$id"
      params={{ id: thread._id }}
      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-fill/60"
    >
      <Avatar person={first} size={40} />
      <div className="min-w-0 flex-1">
        <p className={cn(unread && 'font-semibold')}>{threadTitle(thread)}</p>
        {thread.lastMessage && (
          <p className={cn('truncate text-subhead text-ink-muted', unread && 'text-ink')}>
            {thread.lastMessage.mine ? 'You: ' : ''}
            {thread.lastMessage.text}
          </p>
        )}
      </div>
      {unread && (
        <span className="size-2.5 rounded-full bg-accent">
          <span className="sr-only">Unread</span>
        </span>
      )}
      <ChevronRight className="size-5 text-ink-muted" />
    </Link>
  );
}
