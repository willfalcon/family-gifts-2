import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { addDays, format, parseISO } from 'date-fns';
import { Ampersand, Plus, X } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { formatShortDate, formatWhen } from '@shared/event-dates';
import { showAlert, showError } from '@/components/alerts';
import { Avatar, Card } from '@/components/avatar';
import { FieldRow, Footnote, NotFound, Section, SheetPage, useGoBack } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Checkbox, RadioGroup, RadioGroupItem, Switch } from '@/components/ui/controls';
import { SheetDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEvent, useSecretSantaSetupOptions } from '@/hooks/data';
import { cn, firstName, localToday } from '@/lib/utils';

export const Route = createFileRoute('/_app/events/$id/secret-santa/setup')({
  head: () => ({ meta: [{ title: 'Set Up Secret Santa · Family Gifts' }] }),
  component: SecretSantaSetup,
});

type AttendeeId = Id<'eventAttendees'>;
type SetupOptions = NonNullable<ReturnType<typeof useSecretSantaSetupOptions>>;
type SetupPerson = SetupOptions['people'][number];

// "Keep these two apart". `rememberForGroupId` also saves the pair on that
// group, to be suggested in its future draws.
interface KeepApartRule {
  a: AttendeeId;
  b: AttendeeId;
  rememberForGroupId?: Id<'groups'>;
}

// 'secret': everyone is told their Match as names are drawn, and nobody sees
// who has whom. 'reviewed': hosts see every Match, and nobody is told until a
// host sends the names.
type DrawMode = 'secret' | 'reviewed';

function sameRule(rule: KeepApartRule, a: AttendeeId, b: AttendeeId) {
  return (rule.a === a && rule.b === b) || (rule.a === b && rule.b === a);
}

// Scheduled draws happen at this hour, local time, on the chosen day.
const DRAW_HOUR = 9;

const MODE_OPTIONS: { mode: DrawMode; label: string; description: string }[] = [
  {
    mode: 'secret',
    label: 'Keep matches secret',
    description: 'Everyone is told their person right away after the draw. Nobody sees who has whom, including you.',
  },
  {
    mode: 'reviewed',
    label: 'Let me see the matches',
    description: 'Review and swap matches first. Nobody is told until you send the names.',
  },
];

function statusLabel(person: SetupPerson) {
  if (person.status === 'declined') return 'Not going';
  if (person.status === 'invited') return 'Hasn’t replied';
  return person.role === 'guest' ? 'Going' : 'Host';
}

// "Mom", "Mom and Uncle Ray", "Mom, Uncle Ray, and Sue".
function listNames(names: string[]) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function PersonRow({ person, control, onClick }: { person: SetupPerson; control: React.ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <Avatar person={person} size={40} />
      <span className="flex-1">
        <span className="block">
          {person.name}
          {person.isMe && <span className="text-ink-muted"> (you)</span>}
        </span>
        <span className="block text-footnote text-ink-muted">{statusLabel(person)}</span>
      </span>
      {control}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-line py-2 text-left">
        {content}
      </button>
    );
  }
  return <label className="flex cursor-pointer items-center gap-3 border-b border-line py-2">{content}</label>;
}

// Sets up Secret Santa for an event: who's in, the budget, who to keep apart,
// whether hosts see the matches, and when names get drawn. Hosts only. Ported
// from apps/mobile/src/screens/secret-santa-setup.tsx and
// hooks/secret-santa-setup.tsx; Keep Apart is a dialog here.
function SecretSantaSetup() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const goBack = useGoBack();
  const event = useEvent(id);
  const options = useSecretSantaSetupOptions(event?._id);
  const createSecretSanta = useMutation(api.secretSanta.setup);

  const [picked, setPicked] = useState<AttendeeId[]>([]);
  const [budget, setBudget] = useState('');
  const [rules, setRules] = useState<KeepApartRule[]>([]);
  const [mode, setMode] = useState<DrawMode>('secret');
  // "YYYY-MM-DD", or '' to draw now.
  const [drawDate, setDrawDate] = useState('');
  const [drawEarly, setDrawEarly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [keepingApart, setKeepingApart] = useState(false);

  // Starts from the saved setup when there is one (a scheduled or undone
  // draw); otherwise everyone starts checked, with the pairs remembered for
  // invited groups. Only once, so a live update doesn't undo the host's changes.
  const filled = useRef(false);
  useEffect(() => {
    if (!options || filled.current) return;
    filled.current = true;
    const { saved } = options;
    if (!saved) {
      setPicked(options.people.map(p => p.attendeeId));
      setRules(options.suggestedRules.map(r => ({ a: r.attendeeAId, b: r.attendeeBId })));
      return;
    }
    // Leave out anyone since removed from the event.
    const onEvent = new Set<string>(options.people.map(p => p.attendeeId));
    const ids = saved.attendeeIds.filter(aid => onEvent.has(aid));
    const inDraw = new Set<string>(ids);
    setPicked(ids);
    setRules(
      saved.rules
        .filter(r => inDraw.has(r.attendeeAId) && inDraw.has(r.attendeeBId))
        .map(r => ({ a: r.attendeeAId, b: r.attendeeBId })),
    );
    setMode(saved.mode);
    if (saved.budget != null) setBudget(String(saved.budget));
    if (saved.drawAt != null && saved.drawAt > Date.now()) {
      setDrawDate(format(saved.drawAt, 'yyyy-MM-dd'));
      setDrawEarly(saved.drawEarly);
    }
  }, [options]);

  if (event === null || options === null) return <NotFound message="Only hosts can set up Secret Santa for this event." />;

  function togglePicked(aid: AttendeeId) {
    if (picked.includes(aid)) {
      setPicked(ids => ids.filter(p => p !== aid));
      // A rule needs both people in the draw.
      setRules(list => list.filter(r => r.a !== aid && r.b !== aid));
    } else {
      setPicked(ids => [...ids, aid]);
    }
  }

  const addRule = (rule: KeepApartRule) => setRules(list => [...list.filter(r => !sameRule(r, rule.a, rule.b)), rule]);
  const removeRule = (rule: KeepApartRule) => setRules(list => list.filter(r => !sameRule(r, rule.a, rule.b)));

  const people = options?.people ?? [];
  const byId = new Map(people.map(p => [p.attendeeId as string, p]));
  const drawNow = !drawDate;
  const today = localToday();
  const tomorrow = format(addDays(parseISO(today), 1), 'yyyy-MM-dd');
  const reviewed = mode === 'reviewed';
  // The host doing the setup, if they're in Who's in.
  const meInDraw = people.find(p => p.isMe && picked.includes(p.attendeeId));
  // Picked people who won't be in a draw that happens now.
  const leftOut = people.filter(p => picked.includes(p.attendeeId) && p.status !== 'going');

  function pickDrawDate(value: string) {
    // Today (or earlier) just means now.
    setDrawDate(value > today ? value : '');
  }

  async function submit() {
    if (!event) return;
    const trimmed = budget.trim();
    const amount = trimmed ? Number(trimmed.replace(/[$,]/g, '')) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      void showAlert('Check the spending limit', 'Enter an amount like 25.');
      return;
    }
    let drawAt: number | undefined;
    if (drawDate) {
      const day = parseISO(drawDate);
      day.setHours(DRAW_HOUR, 0, 0, 0);
      drawAt = day.getTime();
    }
    setSubmitting(true);
    try {
      await createSecretSanta({
        eventId: event._id,
        attendeeIds: picked,
        budget: amount,
        rules: rules.map(r => ({ attendeeAId: r.a, attendeeBId: r.b, rememberForGroupId: r.rememberForGroupId })),
        mode,
        drawAt,
        drawEarly,
      });
      // A Reviewed draw done now goes straight to the matches to review.
      if (drawNow && reviewed) navigate({ to: '/events/$id/secret-santa', params: { id }, replace: true });
      else goBack();
    } catch (e) {
      void showError(drawNow ? 'Couldn’t draw names' : 'Couldn’t set up Secret Santa', e);
      setSubmitting(false);
    }
  }

  const drawFootnote = drawNow
    ? `Names are drawn as soon as you click Draw.${
        leftOut.length > 0 ? ` Only people going are in, so ${listNames(leftOut.map(p => p.name))} won’t be included.` : ''
      }`
    : `Names are drawn on ${format(parseISO(drawDate), 'EEE, MMM d')}${drawEarly ? ', or sooner if everyone replies first' : ''}. ${
        reviewed ? 'You’ll get a notification to review them.' : 'Everyone gets a notification.'
      }`;

  return (
    <SheetPage
      title="Secret Santa"
      action={{ label: drawNow ? 'Draw' : 'Save', onClick: () => void submit(), disabled: submitting || !event || picked.length < 2 }}
    >
      <Section>
        {event && (
          <Footnote className="truncate">
            {event.name}
            {(event.date || event.startTime) && ` · ${event.date ? formatShortDate(event.date, event.startTime) : formatWhen(event)}`}
          </Footnote>
        )}
        <div>
          <h2 className="font-semibold text-ink-muted">Who’s in · {picked.length}</h2>
          {people.map(person => (
            <PersonRow
              key={person.attendeeId}
              person={person}
              control={
                <Checkbox
                  checked={picked.includes(person.attendeeId)}
                  onCheckedChange={() => togglePicked(person.attendeeId)}
                  aria-label={`Include ${person.name}`}
                />
              }
            />
          ))}
        </div>
        <Footnote>People who haven’t replied join the draw if they accept before names are drawn.</Footnote>
      </Section>

      <Section title="Budget">
        <FieldRow>
          <label htmlFor="spending-limit">Spending limit</label>
          <div className="flex h-10 w-32 items-center rounded-md bg-fill px-3 focus-within:ring-2 focus-within:ring-ring/50">
            <span className="text-ink-muted">$</span>
            <input
              id="spending-limit"
              inputMode="decimal"
              placeholder="0"
              className="h-full min-w-0 flex-1 bg-transparent pl-1 text-body text-ink outline-none placeholder:text-muted-foreground/60"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
          </div>
        </FieldRow>
      </Section>

      <Section title="Rules">
        {rules.map(rule => {
          const a = byId.get(rule.a);
          const b = byId.get(rule.b);
          if (!a || !b) return null;
          return (
            <div key={`${rule.a}-${rule.b}`} className="flex items-center gap-3 border-b border-line py-2">
              <span className="flex">
                <span className="rounded-full border-2 border-background">
                  <Avatar person={a} size={32} />
                </span>
                <span className="-ml-3 rounded-full border-2 border-background">
                  <Avatar person={b} size={32} />
                </span>
              </span>
              <span className="flex-1">
                {firstName(a.name)} &amp; {firstName(b.name)}
              </span>
              <button
                type="button"
                onClick={() => removeRule(rule)}
                aria-label={`Remove rule for ${a.name} and ${b.name}`}
                className="flex size-8 items-center justify-center rounded-full hover:bg-fill"
              >
                <X className="size-[18px] text-ink-muted" />
              </button>
            </div>
          );
        })}
        <Button variant="link" className="self-start py-2" disabled={picked.length < 2} onClick={() => setKeepingApart(true)}>
          <Plus className="size-[18px]" /> Keep two people apart
        </Button>
      </Section>

      <Section title={<span id="draw-mode">Matches</span>}>
        <RadioGroup aria-labelledby="draw-mode" value={mode} onValueChange={value => setMode(value as DrawMode)}>
          {MODE_OPTIONS.map(option => (
            <label key={option.mode} className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-2">
              <span className="flex-1">
                <span className="block">{option.label}</span>
                <span className="block text-footnote text-ink-muted">{option.description}</span>
              </span>
              <RadioGroupItem value={option.mode} aria-label={option.label} />
            </label>
          ))}
        </RadioGroup>
        {reviewed && meInDraw && (
          <Card className="items-start">
            <p>You’re in the draw, so you’ll also see who’s giving to you.</p>
            <Button variant="secondary" onClick={() => togglePicked(meInDraw.attendeeId)}>
              Leave me out of the draw
            </Button>
          </Card>
        )}
      </Section>

      <Section title="When to draw">
        <FieldRow>
          <label htmlFor="draw-date">Draw names</label>
          <div className="flex items-center gap-1">
            {drawNow ? (
              <span className="px-2 text-ink-muted">Now, or pick a date</span>
            ) : (
              <button
                type="button"
                onClick={() => setDrawDate('')}
                aria-label="Draw now instead"
                title="Draw now instead"
                className="flex size-8 items-center justify-center rounded-full hover:bg-fill"
              >
                <X className="size-4 text-ink-muted" />
              </button>
            )}
            <Input
              id="draw-date"
              type="date"
              className="w-auto"
              min={tomorrow}
              value={drawDate}
              onChange={e => pickDrawDate(e.target.value)}
            />
          </div>
        </FieldRow>
        {!drawNow && (
          <label className="cursor-pointer">
            <FieldRow>
              <span className="flex-1">
                <span className="block">Draw early if everyone replies</span>
                <span className="block text-footnote text-ink-muted">As soon as the last person answers</span>
              </span>
              <Switch aria-label="Draw early if everyone replies" checked={drawEarly} onCheckedChange={setDrawEarly} />
            </FieldRow>
          </label>
        )}
        <Footnote>{drawFootnote}</Footnote>
        <Footnote>
          {reviewed
            ? 'Hosts see who drew whom. Nobody else is told their match until you send the names.'
            : 'Nobody sees who drew whom, not even hosts. Each person only sees their own match, and gets a notification when names are drawn.'}
        </Footnote>
      </Section>

      <KeepApartDialog
        open={keepingApart}
        onClose={() => setKeepingApart(false)}
        options={options}
        picked={picked}
        onAdd={addRule}
      />
    </SheetPage>
  );
}

// Picks two people from the draw who shouldn't draw each other. Ported from
// apps/mobile/src/screens/keep-apart.tsx.
function KeepApartDialog({
  open,
  onClose,
  options,
  picked,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  options: SetupOptions | undefined;
  picked: AttendeeId[];
  onAdd: (rule: KeepApartRule) => void;
}) {
  const [first, setFirst] = useState<AttendeeId>();
  const [second, setSecond] = useState<AttendeeId>();
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirst(undefined);
    setSecond(undefined);
    setRemember(false);
  }, [open]);

  const inDraw = (options?.people ?? []).filter(p => picked.includes(p.attendeeId));
  const byId = new Map(inDraw.map(p => [p.attendeeId as string, p]));

  // The first two clicks fill the cards. After that a click replaces the
  // second person, and clicking someone already picked takes them out.
  function tap(aid: AttendeeId) {
    if (aid === first) {
      setFirst(second);
      setSecond(undefined);
    } else if (aid === second) {
      setSecond(undefined);
    } else if (!first) {
      setFirst(aid);
    } else {
      setSecond(aid);
    }
  }

  // "Remember" saves the pair on a group both are in. Before both are picked,
  // the first invited group stands in.
  const groups = options?.groups ?? [];
  const sharedGroup = first && second ? groups.find(g => g.attendeeIds.includes(first) && g.attendeeIds.includes(second)) : groups[0];

  function add() {
    if (!first || !second) return;
    onAdd({ a: first, b: second, rememberForGroupId: remember ? sharedGroup?.groupId : undefined });
    onClose();
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={o => !o && onClose()}
      title="Keep Apart"
      action={{ label: 'Add', onClick: add, disabled: !first || !second }}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <PickCard person={first ? byId.get(first) : undefined} />
            <Ampersand className="size-8 shrink-0 text-ink-muted" />
            <PickCard person={second ? byId.get(second) : undefined} />
          </div>
          <p className="text-[15px] text-ink-muted">They won’t draw each other, in either direction.</p>
          <p className="rounded-xl bg-fill p-4 text-[14px]">Pick two people. Click someone again to take them out.</p>
        </div>

        <Section title="Everyone in the draw" className="gap-0">
          {inDraw.map(person => {
            const order = person.attendeeId === first ? 1 : person.attendeeId === second ? 2 : null;
            return <PersonRow key={person.attendeeId} person={person} onClick={() => tap(person.attendeeId)} control={<OrderCheck order={order} />} />;
          })}
        </Section>

        {sharedGroup && (
          <label className="cursor-pointer">
            <FieldRow>
              <span className="flex-1">
                <span className="block">Remember for {sharedGroup.name}</span>
                <span className="block text-footnote text-ink-muted">Suggest this pair in future draws</span>
              </span>
              <Switch aria-label={`Remember for ${sharedGroup.name}`} checked={remember} onCheckedChange={setRemember} />
            </FieldRow>
          </label>
        )}
      </div>
    </SheetDialog>
  );
}

function PickCard({ person }: { person: SetupPerson | undefined }) {
  return (
    <div className="flex h-36 min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card p-3">
      {person ? (
        <>
          <Avatar person={person} size={48} />
          <p className="w-full truncate text-center font-semibold">{person.name}</p>
        </>
      ) : (
        <>
          <span className="flex size-12 items-center justify-center rounded-full bg-fill">
            <Plus className="text-ink-muted" strokeWidth={3} />
          </span>
          <p className="text-center text-ink-muted">Pick someone</p>
        </>
      )}
    </div>
  );
}

// Like the round checkbox, but shows which card the person went into.
function OrderCheck({ order }: { order: 1 | 2 | null }) {
  return (
    <span
      aria-label={order ? `Picked ${order}` : 'Not picked'}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border',
        order ? 'border-accent bg-accent' : 'border-input bg-background',
      )}
    >
      {order && <span className="text-[13px] font-bold text-primary-foreground">{order}</span>}
    </span>
  );
}
