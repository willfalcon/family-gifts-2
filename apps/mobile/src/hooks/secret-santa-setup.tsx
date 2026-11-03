import { useQuery } from 'convex/react';
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
  // "YYYY-MM-DD", or '' to draw now.
  drawDate: string;
  setDrawDate: (value: string) => void;
  drawEarly: boolean;
  setDrawEarly: (value: boolean) => void;
}

const SecretSantaSetupContext = createContext<SecretSantaSetup | null>(null);

// Shared by the Secret Santa sheet and the Keep Apart sheet it opens, which
// are separate screens in the same modal.
export function SecretSantaSetupProvider({ eventId, children }: { eventId: Id<'events'> | undefined; children: ReactNode }) {
  const options = useSecretSantaSetupOptions(eventId);
  const [picked, setPicked] = useState<AttendeeId[]>([]);
  const [budget, setBudget] = useState('');
  const [rules, setRules] = useState<KeepApartRule[]>([]);
  const [drawDate, setDrawDate] = useState('');
  const [drawEarly, setDrawEarly] = useState(true);

  // Everyone starts checked, with the pairs remembered for invited groups.
  // Only once, so a live update doesn't undo what the host has changed.
  const filled = useRef(false);
  useEffect(() => {
    if (!options || filled.current) return;
    filled.current = true;
    setPicked(options.people.map(p => p.attendeeId));
    setRules(options.suggestedRules.map(r => ({ a: r.attendeeAId, b: r.attendeeBId })));
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

  const addRule = (rule: KeepApartRule) =>
    setRules(list => [...list.filter(r => !sameRule(r, rule.a, rule.b)), rule]);
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
