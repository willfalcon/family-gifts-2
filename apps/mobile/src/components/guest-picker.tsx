import { useConvex, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { ChevronRight, Link2, Search, UserPlus, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, Share, View } from 'react-native';

import { FieldRow } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { guestKey, type Guest } from '@/hooks/event-draft';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { plural } from '@shared/utils';

const SUGGESTED_COUNT = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the picker is inviting people to. Ids are undefined while loading (or,
// for a new event, before it's saved).
export type InviteTarget =
  { kind: 'event'; eventId: Id<'events'> | undefined } | { kind: 'group'; groupId: Id<'groups'> | undefined };

// People the viewer shares a group or event with, most connections first,
// leaving out anyone already on the target. `search` matches name or email,
// and also finds people outside the viewer's circle who've chosen to be
// findable (listed after the people they know).
function usePeopleToInvite(target: InviteTarget, search?: string) {
  const forEvent = useQuery(
    api.events.knownPeople,
    target.kind === 'event' ? { eventId: target.eventId, search } : 'skip',
  );
  const forGroup = useQuery(
    api.groups.knownPeople,
    target.kind === 'group' && target.groupId ? { groupId: target.groupId, search } : 'skip',
  );
  return target.kind === 'event' ? forEvent : forGroup;
}

type KnownPerson = NonNullable<ReturnType<typeof usePeopleToInvite>>[number];

// Resolves true if they tap `confirmText`.
export function confirm(title: string, message: string, confirmText: string) {
  return new Promise<boolean>(resolve =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]),
  );
}

// Opens the share sheet with the event's join link, creating the link first
// for events from before links existed.
export function useShareInviteLink() {
  const convex = useConvex();
  const resetInviteLink = useMutation(api.events.resetInviteLink);

  return async (eventId: Id<'events'>) => {
    try {
      const link = await convex.query(api.events.getInviteLink, { eventId });
      let url = link?.url ?? null;
      if (!url) {
        const ok = await confirm('Create an invite link?', 'Anyone with the link can join the event.', 'Create');
        if (!ok) return;
        url = await resetInviteLink({ eventId });
      }
      // iOS shares a `url` as a proper link; Android ignores `url`, so it goes in `message`.
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch (e) {
      Alert.alert(
        'Couldn’t share the link',
        e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.',
      );
    }
  };
}

interface GuestPickerProps {
  // Leaves out anyone already on this event or in this group.
  target: InviteTarget;
  guests: Guest[];
  addGuest: (guest: Guest) => void;
  removeGuest: (key: string) => void;
  // Leave out to hide the Share Invite Link row.
  onShareLink?: () => void;
  sharing?: boolean;
  // Extra sections shown under Suggested while not searching.
  children?: ReactNode;
}

// Search, suggestions and "invite someone new", shared by the new-event Add
// People sheet, the event page's Invite Guests sheet and the group page's
// Invite Members sheet.
export function GuestPicker({
  target,
  guests,
  addGuest,
  removeGuest,
  onShareLink,
  sharing,
  children,
}: GuestPickerProps) {
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

  const typedEmail = query.toLowerCase();
  const canInviteTyped =
    EMAIL_PATTERN.test(typedEmail) && !picked.has(typedEmail) && results !== undefined && results.length === 0;

  return (
    <>
      <View className="gap-3">
        <Input
          prepend={Search}
          placeholder="Name or email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          value={search}
          onChangeText={setSearch}
        />
        {guests.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {guests.map(guest => (
              <GuestPill key={guestKey(guest)} guest={guest} onRemove={() => removeGuest(guestKey(guest))} />
            ))}
          </View>
        )}
      </View>

      {query ? (
        // Searching replaces the rest of the screen with matches.
        <View className="gap-2">
          {results?.map(person => (
            <PersonRow
              key={person.userId}
              person={person}
              checked={picked.has(person.userId)}
              onToggle={() => togglePerson(person)}
            />
          ))}
          {canInviteTyped && (
            <Pressable
              onPress={() => {
                addGuest({ kind: 'email', email: typedEmail, name: typedEmail });
                setSearch('');
              }}
            >
              <FieldRow>
                <View className="flex-1 flex-row items-center gap-3 py-1">
                  <Icon as={UserPlus} size={20} className="text-accent" />
                  <Text className="flex-1 text-accent">Invite {typedEmail}</Text>
                </View>
              </FieldRow>
            </Pressable>
          )}
          {results?.length === 0 && !canInviteTyped && !picked.has(typedEmail) && (
            <Text className="text-ink-muted">No one found. Type a full email to invite someone new.</Text>
          )}
        </View>
      ) : (
        <>
          <View className="gap-2">
            <Pressable onPress={() => setAddingNew(open => !open)} accessibilityRole="button">
              <FieldRow>
                <View className="flex-1 flex-row items-center gap-3 py-1">
                  <Icon as={UserPlus} size={20} className="text-accent" />
                  <Text className="flex-1">Invite Someone New</Text>
                  <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                </View>
              </FieldRow>
            </Pressable>
            {addingNew && (
              <View className="gap-2 pl-8">
                <Input placeholder="Name (optional)" value={newName} onChangeText={setNewName} />
                <Input
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  value={newEmail}
                  onChangeText={text => {
                    setNewEmail(text);
                    if (newError) setNewError(null);
                  }}
                  onSubmitEditing={addNewPerson}
                  aria-invalid={!!newError}
                />
                {newError && <Text className="text-sm text-destructive">{newError}</Text>}
                <Button variant="secondary" className="self-start" onPress={addNewPerson}>
                  <Text>Add</Text>
                </Button>
              </View>
            )}
            {onShareLink && (
              <Pressable onPress={onShareLink} disabled={sharing} accessibilityRole="button">
                <FieldRow>
                  <View className="flex-1 flex-row items-center gap-3 py-1">
                    <Icon as={Link2} size={20} className="text-accent" />
                    <View className="flex-1">
                      <Text>Share Invite Link</Text>
                      <Text className="text-[13px] text-ink-muted">Anyone with the link can join</Text>
                    </View>
                    <Icon as={ChevronRight} size={20} className="text-ink-muted" />
                  </View>
                </FieldRow>
              </Pressable>
            )}
          </View>

          {known && known.length > 0 && (
            <View className="gap-0">
              <Text className="font-semibold text-ink-muted text-[15px] mb-2">Suggested</Text>
              {known.slice(0, SUGGESTED_COUNT).map(person => (
                <PersonRow
                  key={person.userId}
                  person={person}
                  checked={picked.has(person.userId)}
                  onToggle={() => togglePerson(person)}
                />
              ))}
            </View>
          )}

          {children}
        </>
      )}
    </>
  );
}

function GuestPill({ guest, onRemove }: { guest: Guest; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-fill py-1.5 pl-3 pr-1.5">
      <Text className="text-[15px]">{guest.name}</Text>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel={`Remove ${guest.name}`}
        className="size-5 items-center justify-center"
      >
        <Icon as={X} size={14} className="text-ink-muted" />
      </Pressable>
    </View>
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
    <Pressable onPress={onToggle} className="flex-row items-center gap-3 border-b border-line py-2">
      <View className="size-10 items-center justify-center rounded-full" style={{ backgroundColor: person.color }}>
        <Text className="text-center text-lg font-semibold text-on-avatar">{person.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text>{person.name}</Text>
        {inCommon ? <Text className="text-[13px] text-ink-muted">{inCommon} in common</Text> : null}
      </View>
      <Checkbox checked={checked} onCheckedChange={onToggle} accessibilityLabel={`Invite ${person.name}`} />
    </Pressable>
  );
}
