// The home screen's sections, ported from apps/mobile/src/components
// (invitation-card, group-invitation, notice-cards, thread-cards, next-up,
// gift-shopping-card, to-do).
import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { format } from 'date-fns';
import { ChevronRight, Plus, Users, X } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { formatRelativeDay, formatShortDate } from '@shared/event-dates';
import { plural } from '@shared/utils';
import { confirm, showError } from '@/components/alerts';
import { Card } from '@/components/avatar';
import { makeListSearch, ThreadRow } from '@/components/threads';
import { Button } from '@/components/ui/button';
import { shoppingSummary, useEvents, useGiftShopping, useMyEventInvites, useMyGroupInvites } from '@/hooks/data';
import { joinNames, localToday } from '@/lib/utils';

export type MyInvite = FunctionReturnType<typeof api.events.myInvites>[number];
type MyGroupInvite = FunctionReturnType<typeof api.groups.myInvites>[number];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold text-muted-foreground">{children}</p>;
}

function CardTitle({ children }: { children: ReactNode }) {
  return <p className="text-xl font-bold">{children}</p>;
}

// "Going" / "Can't go" for one of the viewer's pending event invites. Once
// answered, the invite drops out of myInvites, so whatever renders this goes away.
export function InviteAnswerButtons({ inviteId }: { inviteId: MyInvite['_id'] }) {
  const answer = useMutation(api.events.answerMyInvite);
  const [busy, setBusy] = useState(false);
  const respond = async (status: 'going' | 'declined') => {
    setBusy(true);
    try {
      await answer({ id: inviteId, status });
    } catch (e) {
      showError('Couldn’t answer invite', e);
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-2">
      <Button className="flex-1" variant="secondary" disabled={busy} onClick={() => respond('declined')}>
        Can’t go
      </Button>
      <Button className="flex-1" disabled={busy} onClick={() => respond('going')}>
        Going
      </Button>
    </div>
  );
}

export function GroupInviteAnswerButtons({ inviteId }: { inviteId: MyGroupInvite['_id'] }) {
  const answer = useMutation(api.groups.answerMyInvite);
  const [busy, setBusy] = useState(false);
  const respond = async (accept: boolean) => {
    setBusy(true);
    try {
      await answer({ id: inviteId, accept });
    } catch (e) {
      showError('Couldn’t answer invite', e);
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-2">
      <Button className="flex-1" variant="secondary" disabled={busy} onClick={() => respond(false)}>
        Decline
      </Button>
      <Button className="flex-1" disabled={busy} onClick={() => respond(true)}>
        Join
      </Button>
    </div>
  );
}

// One card per pending event invite.
export function InvitationCards() {
  const invites = useMyEventInvites();
  if (!invites?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {invites.map(invite => {
        const { event } = invite;
        const from = invite.invitedByName ? `${invite.invitedByName} invited you` : 'You’re invited';
        const when = event.date ? ` · ${formatRelativeDay(event.date)}` : '';
        return (
          <Card key={invite._id}>
            <div>
              <Eyebrow>
                {from}
                {when}
              </Eyebrow>
              <CardTitle>{event.name}</CardTitle>
              {event.date && <p>{formatShortDate(event.date, event.startTime)}</p>}
            </div>
            <InviteAnswerButtons inviteId={invite._id} />
          </Card>
        );
      })}
    </div>
  );
}

export function GroupInvitationCards() {
  const invites = useMyGroupInvites();
  if (!invites?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {invites.map(invite => (
        <Card key={invite._id}>
          <div>
            <Eyebrow>
              {invite.invitedByName ? `${invite.invitedByName} invited you to a group` : 'You’re invited to a group'}
            </Eyebrow>
            <CardTitle>{invite.group.name}</CardTitle>
            <p>{plural(invite.group.memberCount, 'member')}</p>
          </div>
          <GroupInviteAnswerButtons inviteId={invite._id} />
        </Card>
      ))}
    </div>
  );
}

// A pending group invite at the top of the People screen.
export function GroupInvitationListItem({ invite }: { invite: MyGroupInvite }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill">
        <Users className="size-5 text-ink-muted" />
      </span>
      <div className="flex flex-1 flex-col gap-3 border-b border-line pb-3">
        <div>
          <p className="font-semibold">{invite.group.name}</p>
          <p className="text-sm text-ink-muted">
            {plural(invite.group.memberCount, 'member')}
            {invite.invitedByName ? ` · Invited by ${invite.invitedByName}` : ''}
          </p>
        </div>
        <GroupInviteAnswerButtons inviteId={invite._id} />
      </div>
    </div>
  );
}

type Notice = FunctionReturnType<typeof api.notices.mine>[number];

const NOTICE_COPY: Record<Notice['kind'], { title: string; body: string }> = {
  secretSantaUndone: {
    title: 'The draw was redone',
    body: 'Your old match no longer counts. You’ll get a new one when names are drawn again.',
  },
};

// One dismissible card per Notice.
export function NoticeCards() {
  const notices = useQuery(api.notices.mine);
  const dismiss = useMutation(api.notices.dismiss);
  if (!notices?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {notices.map(notice => {
        const { title, body } = NOTICE_COPY[notice.kind];
        return (
          <Card key={notice._id} className="flex-row items-start">
            <Link to="/events/$id" params={{ id: notice.eventId }} className="flex-1">
              <Eyebrow>Secret Santa · {notice.eventName}</Eyebrow>
              <CardTitle>{title}</CardTitle>
              <p>{body}</p>
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-full p-1 text-ink-muted hover:bg-fill"
              onClick={() => dismiss({ id: notice._id }).catch(() => {})}
            >
              <X className="size-5" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}

// Open Asks to you, grouped by occasion; Secret Santa Asks; unread Threads.
export function ThreadCards() {
  const home = useQuery(api.threads.home, { today: localToday() });
  if (!home?.hasThreads) return null;
  const { askGroups, santaAsks, threads } = home;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-muted-foreground">Messages</h2>
        <Link to="/messages" className="text-accent hover:underline">
          See all
        </Link>
      </div>
      {askGroups.map(group => (
        <Card key={group.key}>
          <p className="text-lg font-bold">
            {group.label ? `${group.label} · ` : ''}
            {joinNames(group.askers)} asked for ideas
          </p>
          <div className="flex flex-col gap-1">
            {group.threads.map(thread => (
              <ThreadRow key={thread._id} thread={thread} />
            ))}
          </div>
          <MakeListButton search={makeListSearch(group)} />
        </Card>
      ))}
      {santaAsks.map(ask => (
        <Card key={ask.key}>
          <div>
            <p className="text-lg font-bold">Your Secret Santa asked for ideas</p>
            {ask.label && <p className="text-subhead text-ink-muted">{ask.label}</p>}
          </div>
          <ThreadRow thread={ask.thread} />
        </Card>
      ))}
      {threads.map(thread => (
        <ThreadRow key={thread._id} thread={thread} />
      ))}
    </section>
  );
}

export function MakeListButton({ search, className }: { search: ReturnType<typeof makeListSearch>; className?: string }) {
  return (
    <Button asChild variant="secondary" size="sm" className={className ?? 'self-start'}>
      <Link to="/lists/new" search={search}>
        <Plus className="text-accent" strokeWidth={2.5} />
        <span className="text-accent">Make a list</span>
      </Link>
    </Button>
  );
}

export function NextUp() {
  const events = useEvents();
  const nextEvent = events?.find(e => e.cancelledAt === undefined) ?? null;
  if (!nextEvent) return null;
  const when = nextEvent.date ? formatRelativeDay(nextEvent.date) : undefined;
  const date =
    nextEvent.date &&
    new Date(`${nextEvent.date}T00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Link to="/events/$id" params={{ id: nextEvent._id }}>
      <Card className="transition-colors hover:bg-surface/70">
        <div>
          <Eyebrow>Next up{when ? ` · ${when}` : ''}</Eyebrow>
          <CardTitle>{nextEvent.name}</CardTitle>
          {date && <p>{date}</p>}
        </div>
      </Card>
    </Link>
  );
}

// "Shopping for 4 · 3 to buy".
export function GiftShoppingCard() {
  const data = useGiftShopping();
  if (!data) return null;
  const { shoppingFor, toBuy } = shoppingSummary(data);
  const summary =
    shoppingFor === 0 && toBuy === 0
      ? 'Nobody to shop for yet'
      : [shoppingFor > 0 ? `Shopping for ${shoppingFor} ${shoppingFor === 1 ? 'person' : 'people'}` : null, `${toBuy} to buy`]
          .filter(Boolean)
          .join(' · ');
  return (
    <Link to="/shopping">
      <Card className="flex-row items-center">
        <div className="flex-1">
          <Eyebrow>Gift Shopping</Eyebrow>
          <CardTitle>{summary}</CardTitle>
        </div>
        <ChevronRight className="size-5 text-ink-muted" />
      </Card>
    </Link>
  );
}

type ToDo = FunctionReturnType<typeof api.toDos.mine>[number];

const SHOWN = 4;

function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d');
}

function copyFor(toDo: ToDo) {
  const when = toDo.date ? `${toDo.label} · ${shortDate(toDo.date)}` : toDo.label;
  switch (toDo.kind) {
    case 'makeList':
      return {
        title: toDo.occasion === 'birthday' ? 'Make a list for your birthday' : 'Make a list',
        subtitle: toDo.occasion === 'birthday' && toDo.date ? shortDate(toDo.date) : when,
      };
    case 'addIdeas':
      return {
        title: 'Add a few ideas to your list',
        subtitle: `${when} · ${toDo.itemCount ? `${toDo.itemCount} so far` : 'nothing on it yet'}`,
      };
    case 'setUpSecretSanta':
      return { title: 'Set up Secret Santa', subtitle: when };
    case 'sendNames':
      return { title: 'Send the names', subtitle: `${toDo.label} · nobody’s been told yet` };
    case 'matchGift':
      return { title: 'Get your Secret Santa gift', subtitle: when };
  }
}

function ToDoLink({ toDo, children }: { toDo: ToDo; children: ReactNode }) {
  const className = 'flex flex-1 items-center gap-2';
  switch (toDo.kind) {
    case 'makeList':
      return (
        <Link to="/lists/new" search={toDo.eventId ? { eventId: toDo.eventId } : { occasion: 'birthday' }} className={className}>
          {children}
        </Link>
      );
    case 'addIdeas':
      return (
        <Link to="/lists/$id" params={{ id: toDo.listId! }} className={className}>
          {children}
        </Link>
      );
    case 'setUpSecretSanta':
      return (
        <Link to="/events/$id/secret-santa/setup" params={{ id: toDo.eventId! }} className={className}>
          {children}
        </Link>
      );
    case 'sendNames':
    case 'matchGift':
      return (
        <Link to="/events/$id/secret-santa" params={{ id: toDo.eventId! }} className={className}>
          {children}
        </Link>
      );
  }
}

// What the app suggests doing next (see To-do in GLOSSARY.md).
export function ToDos() {
  const toDos = useQuery(api.toDos.mine, { today: localToday() });
  const dismiss = useMutation(api.toDos.dismiss);
  const setSecretSantaOff = useMutation(api.secretSanta.setOff);
  const [showAll, setShowAll] = useState(false);
  if (!toDos?.length) return null;

  async function onDismiss(toDo: ToDo) {
    // Dismissing this one turns Secret Santa off for the event, for every host.
    if (toDo.kind === 'setUpSecretSanta') {
      const ok = await confirm({
        title: 'Not doing Secret Santa?',
        message: `Secret Santa will be turned off for ${toDo.label}. Any host can turn it back on by editing the event.`,
        confirmText: 'Turn off',
      });
      if (!ok) return;
      setSecretSantaOff({ eventId: toDo.eventId!, off: true }).catch(e => showError('Couldn’t turn off Secret Santa', e));
      return;
    }
    dismiss({ key: toDo.key }).catch(() => {});
  }

  const shown = showAll ? toDos : toDos.slice(0, SHOWN);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-muted-foreground">To do</h2>
      {shown.map(toDo => {
        const { title, subtitle } = copyFor(toDo);
        return (
          <div key={toDo.key} className="flex items-center gap-3 border-b border-line pb-2">
            <ToDoLink toDo={toDo}>
              <div className="flex-1">
                <p className="text-lg">{title}</p>
                <p className="text-muted-foreground">{subtitle}</p>
              </div>
              <ChevronRight className="size-5 text-ink-muted" />
            </ToDoLink>
            <button
              type="button"
              aria-label={`Dismiss ${title}`}
              title="Dismiss"
              className="rounded-full p-1 text-ink-muted hover:bg-fill"
              onClick={() => onDismiss(toDo)}
            >
              <X className="size-[18px]" />
            </button>
          </div>
        );
      })}
      {toDos.length > SHOWN && (
        <button type="button" className="self-start text-accent hover:underline" onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show less' : `Show all ${toDos.length}`}
        </button>
      )}
    </section>
  );
}
