import { useState, type ReactNode } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { ChevronRight, Link2, Search, UserPlus, X } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { plural } from '@shared/utils';
import { confirm, showAlert, showError } from '@/components/alerts';
import { ErrorText } from '@/components/auth-forms';
import { Avatar } from '@/components/avatar';
import { Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';

// Someone picked to invite. Known people are invited by account, so the app
// never needs their email; anyone else is invited by the email typed in.
export type Guest = { kind: 'user'; userId: string; name: string } | { kind: 'email'; email: string; name: string };

export function guestKey(guest: Guest) {
  return guest.kind === 'user' ? guest.userId : guest.email;
}

// A list of picked guests, without duplicates.
export function useGuests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const addGuest = (guest: Guest) => setGuests(list => (list.some(g => guestKey(g) === guestKey(guest)) ? list : [...list, guest]));
  const removeGuest = (key: string) => setGuests(list => list.filter(g => guestKey(g) !== key));
  return { guests, addGuest, removeGuest };
}

const SUGGESTED_COUNT = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteTarget =
  | { kind: 'event'; eventId: Id<'events'> | undefined }
  | { kind: 'group'; groupId: Id<'groups'> | undefined };

// People the viewer shares a group or event with, leaving out anyone already
// on the target. `search` also finds Discoverable people outside their circle.
function usePeopleToInvite(target: InviteTarget, search?: string) {
  const forEvent = useQuery(api.events.knownPeople, target.kind === 'event' ? { eventId: target.eventId, search } : 'skip');
  const forGroup = useQuery(
    api.groups.knownPeople,
    target.kind === 'group' && target.groupId ? { groupId: target.groupId, search } : 'skip',
  );
  return target.kind === 'event' ? forEvent : forGroup;
}

type KnownPerson = NonNullable<ReturnType<typeof usePeopleToInvite>>[number];

// The browser's share sheet where there is one (phones), otherwise copy.
export async function shareLink(url: string) {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  await copyLink(url);
}

export async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    showAlert('Link copied', url);
  } catch {
    showAlert('Invite link', url);
  }
}

// Shares the event's join link, creating it first for events from before links existed.
export function useShareEventLink() {
  const convex = useConvex();
  const resetInviteLink = useMutation(api.events.resetInviteLink);
  return async (eventId: Id<'events'>) => {
    try {
      const link = await convex.query(api.events.getInviteLink, { eventId });
      let url = link?.url ?? null;
      if (!url) {
        const ok = await confirm({ title: 'Create an invite link?', message: 'Anyone with the link can join the event.', confirmText: 'Create' });
        if (!ok) return;
        url = await resetInviteLink({ eventId });
      }
      await shareLink(url);
    } catch (e) {
      showError('Couldn’t share the link', e);
    }
  };
}

// Search, suggestions and "invite someone new", shared by the new-event
// guests, the event's Invite Guests page and the group's Invite Members page.
export function GuestPicker({
  target,
  guests,
  addGuest,
  removeGuest,
  onShareLink,
  sharing,
  children,
}: {
  target: InviteTarget;
  guests: Guest[];
  addGuest: (guest: Guest) => void;
  removeGuest: (key: string) => void;
  onShareLink?: () => void;
  sharing?: boolean;
  // Extra sections shown under Suggested while not searching.
  children?: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newError, setNewError] = useState<string | null>(null);

  const query = search.trim();
  const known = usePeopleToInvite(target);
  const results = usePeopleToInvite(target, query || undefined);
  const picked = new Set(guests.map(guestKey));

  function togglePerson(person: KnownPerson) {
    if (picked.has(person.userId)) removeGuest(person.userId);
    else addGuest({ kind: 'user', userId: person.userId, name: person.name });
  }

  function addNewPerson() {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setNewError('Enter a valid email');
      return;
    }
    addGuest({ kind: 'email', email, name: newName.trim() || email });
    setNewName('');
    setNewEmail('');
    setNewError(null);
    setAddingNew(false);
  }

  // A typed email can be invited directly unless one of the results is the
  // person with exactly that email.
  const typedEmail = query.toLowerCase();
  const canInviteTyped =
    EMAIL_PATTERN.test(typedEmail) && !picked.has(typedEmail) && results !== undefined && !results.some(p => p.emailMatch);

  return (
    <>
      <div className="flex flex-col gap-3">
        <Input
          prepend={Search}
          type="search"
          placeholder="Name or email"
          aria-label="Search by name or email"
          autoComplete="off"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canInviteTyped) {
                addGuest({ kind: 'email', email: typedEmail, name: typedEmail });
                setSearch('');
              }
            }
          }}
        />
        {guests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {guests.map(guest => (
              <span key={guestKey(guest)} className="flex items-center gap-1 rounded-full bg-fill py-1.5 pr-1.5 pl-3 text-[15px]">
                {guest.name}
                <button
                  type="button"
                  onClick={() => removeGuest(guestKey(guest))}
                  aria-label={`Remove ${guest.name}`}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-line"
                >
                  <X className="size-3.5 text-ink-muted" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {query ? (
        <div className="flex flex-col gap-2">
          {canInviteTyped && (
            <button
              type="button"
              className="flex items-center gap-3 border-b border-line py-2 text-left text-accent"
              onClick={() => {
                addGuest({ kind: 'email', email: typedEmail, name: typedEmail });
                setSearch('');
              }}
            >
              <UserPlus className="size-5" />
              Invite {typedEmail}
            </button>
          )}
          {results?.map(person => (
            <PersonRow key={person.userId} person={person} checked={picked.has(person.userId)} onToggle={() => togglePerson(person)} />
          ))}
          {results?.length === 0 && !canInviteTyped && !picked.has(typedEmail) && (
            <p className="text-ink-muted">No one found. Type a full email to invite someone new.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            <button
              type="button"
              aria-expanded={addingNew}
              onClick={() => setAddingNew(open => !open)}
              className="flex items-center gap-3 border-b border-line py-3 text-left"
            >
              <UserPlus className="size-5 text-accent" />
              <span className="flex-1">Invite Someone New</span>
              <ChevronRight className="size-5 text-ink-muted" />
            </button>
            {addingNew && (
              <div className="flex flex-col gap-2 py-3 pl-8">
                <Input placeholder="Name (optional)" aria-label="Name" value={newName} onChange={e => setNewName(e.target.value)} />
                <Input
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  value={newEmail}
                  onChange={e => {
                    setNewEmail(e.target.value);
                    setNewError(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addNewPerson();
                    }
                  }}
                  aria-invalid={!!newError}
                />
                <ErrorText>{newError}</ErrorText>
                <Button variant="secondary" className="self-start" onClick={addNewPerson}>
                  Add
                </Button>
              </div>
            )}
            {onShareLink && (
              <button
                type="button"
                onClick={onShareLink}
                disabled={sharing}
                className="flex items-center gap-3 border-b border-line py-3 text-left disabled:opacity-50"
              >
                <Link2 className="size-5 text-accent" />
                <span className="flex-1">
                  <span className="block">Share Invite Link</span>
                  <span className="block text-[13px] text-ink-muted">Anyone with the link can join</span>
                </span>
                <ChevronRight className="size-5 text-ink-muted" />
              </button>
            )}
          </div>

          {known && known.length > 0 && (
            <Section title="Suggested">
              <div>
                {known.slice(0, SUGGESTED_COUNT).map(person => (
                  <PersonRow key={person.userId} person={person} checked={picked.has(person.userId)} onToggle={() => togglePerson(person)} />
                ))}
              </div>
            </Section>
          )}
          {children}
        </>
      )}
    </>
  );
}

function PersonRow({ person, checked, onToggle }: { person: KnownPerson; checked: boolean; onToggle: () => void }) {
  const inCommon = [
    person.sharedGroups > 0 && plural(person.sharedGroups, 'group'),
    person.sharedEvents > 0 && plural(person.sharedEvents, 'event'),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-line py-2">
      <Avatar person={person} size={40} />
      <span className="flex-1">
        <span className="block">{person.name}</span>
        {inCommon && <span className="block text-[13px] text-ink-muted">{inCommon} in common</span>}
      </span>
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Invite ${person.name}`} />
    </label>
  );
}
