// The Secret Santa page's pieces, ported from
// apps/mobile/src/components/secret-santa/*.
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowRight, Check, Gift } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { swapProblem, type Exclusion, type SwapProblem } from '@shared/secret-santa';
import { showAlert, showError } from '@/components/alerts';
import { Avatar } from '@/components/avatar';
import { FieldRow, Footnote, Section } from '@/components/page';
import { Switch } from '@/components/ui/controls';
import { useMatchItems } from '@/hooks/data';
import { cn, firstName, joinNames } from '@/lib/utils';

// ---- Gift ready ----

export interface GiftReadyPerson {
  userId: string;
  name: string;
  color: string;
  giftReady: boolean;
}

// "I have their gift", plus how many in the draw are Gift ready. The switch
// only names the Match once it's revealed, so it's safe to use while hidden.
// Hosts of a Reviewed draw also get `people`, to see who has their gift.
export function GiftReady({
  eventId,
  myUserId,
  matchName,
  giftReady,
  progress,
  reviewed,
  people,
}: {
  eventId: Id<'events'>;
  myUserId?: string;
  matchName: string | null;
  // null when the viewer isn't in the draw (a host who's only running it):
  // there's no switch then.
  giftReady: boolean | null;
  progress: { ready: number; total: number };
  reviewed: boolean;
  people?: GiftReadyPerson[];
}) {
  const setGiftReady = useMutation(api.secretSanta.setGiftReady).withOptimisticUpdate((store, args) => {
    const state = store.getQuery(api.secretSanta.getState, { eventId: args.eventId });
    if (!state?.exists || !state.myAssignment || !state.giftProgress) return;
    const change = args.giftReady === state.myAssignment.giftReady ? 0 : args.giftReady ? 1 : -1;
    store.setQuery(
      api.secretSanta.getState,
      { eventId: args.eventId },
      {
        ...state,
        myAssignment: { ...state.myAssignment, giftReady: args.giftReady },
        giftProgress: { ...state.giftProgress, ready: state.giftProgress.ready + change },
        // A host's own row in the list below, so it flips with the switch.
        ...(state.isManager && {
          assignments: state.assignments.map(a =>
            a.giverUserId === myUserId ? { ...a, giftReady: args.giftReady } : a,
          ),
        }),
      },
    );
  });

  const label = matchName ? `I have ${firstName(matchName)}’s gift` : 'I have my Match’s gift';
  const fraction = progress.total > 0 ? progress.ready / progress.total : 0;

  return (
    <div className="flex flex-col gap-4">
      {giftReady !== null && (
        <label className="cursor-pointer">
          <FieldRow>
            <span className="flex-1 pr-3">
              <span className="block">{label}</span>
              <span className="block text-[13px] text-ink-muted">
                {reviewed
                  ? 'Hosts can see who has their gift'
                  : 'Only counts toward the total. Nobody sees who it’s for'}
              </span>
            </span>
            <Switch
              aria-label={label}
              checked={giftReady}
              onCheckedChange={checked =>
                setGiftReady({ eventId, giftReady: checked }).catch(e => showError('Couldn’t update', e))
              }
            />
          </FieldRow>
        </label>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-[15px] text-ink-muted">
          {progress.ready} out of {progress.total} have their gift
        </p>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-fill"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.ready}
        >
          <div className="h-full rounded-full bg-success" style={{ width: `${fraction * 100}%` }} />
        </div>
      </div>
      {people && people.length > 0 && (
        // Wrapping pills: green-bordered with a check once they have their gift.
        <ul className="flex flex-wrap gap-2">
          {people.map(person => (
            <li
              key={person.userId}
              className={cn(
                'flex items-center gap-1.5 rounded-pill border py-1 pr-3 pl-1',
                person.giftReady ? 'border-success bg-surface' : 'border-transparent bg-fill',
              )}
              aria-label={`${person.name}: ${person.giftReady ? 'has their gift' : 'not yet'}`}
            >
              <Avatar person={person} size={24} />
              <span className="text-[15px]">{person.name}</span>
              {person.giftReady && <Check className="size-3.5 text-success" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Match ----

// Their photo if they have one, otherwise their initial on their color.
export function MatchAvatar({ match }: { match: { name: string; image: string | null; color: string } }) {
  return <Avatar person={match} size={112} />;
}

type MatchItem = NonNullable<ReturnType<typeof useMatchItems>>['items'][number];

// One suggested item. Ones you can't get are muted, with why on the right.
function MatchItemRow({ item, budget, showList }: { item: MatchItem; budget: number | null; showList: boolean }) {
  const muted = item.status === 'overBudget' || item.status === 'claimed';
  const reason =
    item.status === 'mine'
      ? 'Claimed by you'
      : item.status === 'claimed'
        ? `Already claimed by ${joinNames(item.claimedBy, 'someone')}`
        : item.status === 'overBudget'
          ? `Over $${budget}`
          : null;
  // Other lists' items say which list they're from.
  const detail = [item.price != null ? `$${item.price}` : null, showList ? item.listTitle : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to="/lists/$id/items/$itemId"
      params={{ id: item.listId, itemId: item._id }}
      className="flex items-center gap-3 border-b border-line pb-3"
    >
      <span className={muted ? 'opacity-50' : undefined}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="size-11 rounded-[10px] object-cover" />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-[10px] bg-fill">
            <Gift className="size-5 text-ink-muted" />
          </span>
        )}
      </span>
      <span className={cn('min-w-0 flex-1', muted && 'opacity-50')}>
        <span className="block truncate text-[17px]">{item.name}</span>
        {detail !== '' && <span className="block truncate text-[13px] text-ink-muted">{detail}</span>}
      </span>
      {reason && (
        <span
          className={cn(
            'line-clamp-2 max-w-[45%] text-[13px]',
            item.status === 'mine' ? 'text-accent' : 'text-ink-muted',
          )}
        >
          {reason}
        </span>
      )}
    </Link>
  );
}

// A few ideas for your Match: from their list for this event, or their other lists.
export function MatchItems({
  eventId,
  match,
  budget,
}: {
  eventId: Id<'events'> | undefined;
  match: { userId: string; name: string };
  budget: number | null;
}) {
  const data = useMatchItems(eventId);
  if (!data) return null;

  const first = firstName(match.name) ?? match.name;
  const { eventList, items } = data;

  let heading: string;
  let empty: string | null = null;
  if (eventList) {
    heading = `From ${first}’s ${eventList.title}`;
    if (items.length === 0) empty = `${first} hasn’t added anything yet.`;
  } else if (items.length > 0) {
    heading = `From ${first}’s lists`;
  } else {
    heading = `${first}’s lists`;
    empty = 'Nothing you can see yet.';
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-muted">{heading}</h2>
        {eventList ? (
          <Link to="/lists/$id" params={{ id: eventList._id }} className="text-[15px] text-accent hover:underline">
            See all
          </Link>
        ) : (
          <Link to="/people/$id" params={{ id: match.userId }} className="text-[15px] text-accent hover:underline">
            See all
          </Link>
        )}
      </div>
      {empty ? (
        <p className="text-ink-muted">{empty}</p>
      ) : (
        items.map(item => <MatchItemRow key={item._id} item={item} budget={budget} showList={!eventList} />)
      )}
    </div>
  );
}

// ---- Review ----

type HostState = Extract<FunctionReturnType<typeof api.secretSanta.getState>, { isManager: true }>;
type Assignment = HostState['assignments'][number];

// Every Match in a Reviewed draw, for hosts. Before the names are sent, click
// one row, then another, to swap who they're giving to. Rows that can't be
// swapped with the selected one (someone would get themselves, or two people
// kept apart would be matched) are dimmed.
export function ReviewMatches({
  eventId,
  assignments,
  exclusions,
  editable,
}: {
  eventId: Id<'events'>;
  assignments: Assignment[];
  exclusions: Exclusion[];
  // Matches can only be swapped until the names are sent.
  editable: boolean;
}) {
  const swap = useMutation(api.secretSanta.swap);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const selected = editable ? assignments.find(a => a.giverUserId === selectedId) : undefined;
  const nameOf = new Map(assignments.map(a => [a.giverUserId, a.giverName]));

  function explain(problem: SwapProblem) {
    const name = nameOf.get(problem.userId) ?? 'Someone';
    return problem.kind === 'self'
      ? `${name} would be giving to themselves.`
      : `${name} and ${nameOf.get(problem.otherUserId) ?? 'their match'} are kept apart.`;
  }

  async function press(row: Assignment) {
    if (!editable || swapping) return;
    if (!selected) return setSelectedId(row.giverUserId);
    if (selected.giverUserId === row.giverUserId) return setSelectedId(null);

    const problem = swapProblem(selected, row, exclusions);
    if (problem) {
      void showAlert('Can’t swap these two', explain(problem));
      return;
    }
    setSwapping(true);
    try {
      await swap({ eventId, giverAUserId: selected.giverUserId, giverBUserId: row.giverUserId });
      setSelectedId(null);
    } catch (e) {
      void showError('Couldn’t swap', e);
    } finally {
      setSwapping(false);
    }
  }

  const hint = !editable
    ? null
    : selected
      ? `Now click who ${selected.giverName} should swap with.`
      : 'Click two people to swap who they’re giving to.';

  return (
    <Section title="Matches">
      {hint && <Footnote className="-mt-1">{hint}</Footnote>}
      <div>
        {assignments.map(row => {
          const isSelected = selected?.giverUserId === row.giverUserId;
          const blocked = !!selected && !isSelected && !!swapProblem(selected, row, exclusions);
          return (
            <button
              type="button"
              key={row.giverUserId}
              onClick={() => press(row)}
              disabled={!editable}
              aria-pressed={editable ? isSelected : undefined}
              aria-label={`${row.giverName} gives to ${row.receiverName}`}
              className={cn(
                '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left disabled:cursor-default',
                editable && 'hover:bg-fill/60',
                isSelected && 'bg-fill',
                blocked && 'opacity-40',
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar person={{ name: row.giverName, color: row.giverColor }} size={40} />
                <span className="truncate">{row.giverName}</span>
              </span>
              <ArrowRight className="size-[18px] text-ink-muted" />
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span className="truncate text-right">{row.receiverName}</span>
                <Avatar person={{ name: row.receiverName, color: row.receiverColor }} size={40} />
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
