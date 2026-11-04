import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type AttendeeId = Id<'eventAttendees'>;

export type SetupOptions = NonNullable<ReturnType<typeof useSecretSantaSetupOptions>>;
export type SetupPerson = SetupOptions['people'][number];

// "Keep these two apart". `rememberForGroupId` also saves the pair on that
// group, to be suggested in its future draws.
export interface KeepApartRule {
  a: AttendeeId;
  b: AttendeeId;
  rememberForGroupId?: Id<'groups'>;
}

// 'secret': everyone is told their Match as names are drawn, and nobody sees
// who has whom. 'reviewed': hosts see every Match, and nobody is told until a
// host sends the names.
export type DrawMode = 'secret' | 'reviewed';

export function sameRule(rule: KeepApartRule, a: AttendeeId, b: AttendeeId) {
  return (rule.a === a && rule.b === b) || (rule.a === b && rule.b === a);
}

// Everyone on the guest list, invited groups and remembered pairs. Hosts only;
// null for anyone else.
export function useSecretSantaSetupOptions(eventId: Id<'events'> | undefined) {
  return useQuery(api.secretSanta.setupOptions, eventId ? { eventId } : 'skip');
}

interface SecretSantaSetup {
  options: SetupOptions | null | undefined;
  // Who's in the draw.
  picked: AttendeeId[];
  togglePicked: (id: AttendeeId) => void;
  budget: string;
  setBudget: (value: string) => void;
  rules: KeepApartRule[];
  addRule: (rule: KeepApartRule) => void;
  removeRule: (rule: KeepApartRule) => void;
  mode: DrawMode;
  setMode: (value: DrawMode) => void;
  // "YYYY-MM-DD", or '' to draw now.
  drawDate: string;
  setDrawDate: (value: string) => void;
  drawEarly: boolean;
  setDrawEarly: (value: boolean) => void;
}

const SecretSantaSetupContext = createContext<SecretSantaSetup | null>(null);

// Shared by the Secret Santa sheet and the Keep Apart sheet it opens, which
// are separate screens in the same modal.
export function SecretSantaSetupProvider({
  eventId,
  children,
}: {
  eventId: Id<'events'> | undefined;
  children: ReactNode;
}) {
  const options = useSecretSantaSetupOptions(eventId);
  const [picked, setPicked] = useState<AttendeeId[]>([]);
  const [budget, setBudget] = useState('');
  const [rules, setRules] = useState<KeepApartRule[]>([]);
  const [mode, setMode] = useState<DrawMode>('secret');
  const [drawDate, setDrawDate] = useState('');
  const [drawEarly, setDrawEarly] = useState(true);

  // Starts from the saved setup when there is one (a scheduled or undone
  // draw); otherwise everyone starts checked, with the pairs remembered for
  // invited groups. Only once, so a live update doesn't undo what the host
  // has changed.
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
    const ids = saved.attendeeIds.filter(id => onEvent.has(id));
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

  function togglePicked(id: AttendeeId) {
    if (picked.includes(id)) {
      setPicked(ids => ids.filter(p => p !== id));
      // A rule needs both people in the draw.
      setRules(list => list.filter(r => r.a !== id && r.b !== id));
    } else {
      setPicked(ids => [...ids, id]);
    }
  }

  const addRule = (rule: KeepApartRule) => setRules(list => [...list.filter(r => !sameRule(r, rule.a, rule.b)), rule]);
  const removeRule = (rule: KeepApartRule) => setRules(list => list.filter(r => !sameRule(r, rule.a, rule.b)));

  return (
    <SecretSantaSetupContext.Provider
      value={{
        options,
        picked,
        togglePicked,
        budget,
        setBudget,
        rules,
        addRule,
        removeRule,
        mode,
        setMode,
        drawDate,
        setDrawDate,
        drawEarly,
        setDrawEarly,
      }}
    >
      {children}
    </SecretSantaSetupContext.Provider>
  );
}

export function useSecretSantaSetup() {
  const setup = useContext(SecretSantaSetupContext);
  if (!setup) throw new Error('useSecretSantaSetup must be used inside SecretSantaSetupProvider');
  return setup;
}

// The event's Secret Santa as the viewer may see it. Pass undefined to skip.
export function useSecretSanta(eventId: Id<'events'> | undefined) {
  return useQuery(api.secretSanta.getState, eventId ? { eventId } : 'skip');
}

// A few items to suggest for your Match, once names are drawn. Null if you
// have no Match.
export function useMatchItems(eventId: Id<'events'> | undefined) {
  return useQuery(api.secretSanta.matchItems, eventId ? { eventId } : 'skip');
}
