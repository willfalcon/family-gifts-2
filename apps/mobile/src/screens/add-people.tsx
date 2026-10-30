import { useConvex, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useRouter } from 'expo-router';
import { ChevronRight, Link2, Search, UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { FieldRow } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { guestKey, useEventDraft, type Guest } from '@/hooks/event-draft';
import { useKnownPeople } from '@/hooks/events';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';
import { plural } from '@shared/utils';

const SUGGESTED_COUNT = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type KnownPerson = NonNullable<ReturnType<typeof useKnownPeople>>[number];

// Resolves true if they tap `confirmText`.
function confirm(title: string, message: string, confirmText: string) {
  return new Promise<boolean>(resolve =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]),
  );
}

// Picks who to invite to a new event. Picks are kept in the event draft and
// only sent when the event form is submitted.
export default function AddPeople() {
  const router = useRouter();
  const draft = useEventDraft();
  const convex = useConvex();
  const resetInviteLink = useMutation(api.events.resetInviteLink);

  const [search, setSearch] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const query = search.trim();
  const known = useKnownPeople(draft?.eventId);
  const results = useKnownPeople(draft?.eventId, query || undefined);

  if (!draft) return null;
  const { guests, addGuest, removeGuest } = draft;
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

  // The link belongs to the event, so a new event is saved first.
  async function shareInviteLink() {
    if (!draft) return;
    setSharing(true);
    try {
      let eventId: Id<'events'> | undefined = draft.eventId;
      if (!eventId) {
        const ok = await confirm(
          'Create the event first?',
          'An invite link needs the event to exist. It’ll be saved with what you’ve filled in so far, and you can keep editing.',
          'Create',
        );
        if (!ok) return;
        const result = await draft.saveEvent.current?.();
        if (!result) return;
        if ('error' in result) {
          Alert.alert('Can’t create the event yet', result.error);
          return;
        }
        eventId = result.id;
      }

      const link = await convex.query(api.events.getInviteLink, { eventId });
      let url = link?.url ?? null;
      if (!url) {
        // Events from before links existed have none until a host makes one.
        const ok = await confirm('Create an invite link?', 'Anyone with the link can join the event.', 'Create');
        if (!ok) return;
        url = await resetInviteLink({ eventId });
      }

      // iOS shares a `url` as a proper link; Android ignores `url`, so it goes in `message`.
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch (e) {
      Alert.alert('Couldn’t share the link', e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
    } finally {
      setSharing(false);
    }
  }

  const typedEmail = query.toLowerCase();
  const canInviteTyped =
    EMAIL_PATTERN.test(typedEmail) && !picked.has(typedEmail) && results !== undefined && results.length === 0;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <View className="w-20" />
        <Text className="flex-1 text-center text-lg font-bold">Add People</Text>
        <GlassButton
          className="w-20"
          accessibilityLabel="Done"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-accent-foreground">Done</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
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
              <Pressable onPress={shareInviteLink} disabled={sharing} accessibilityRole="button">
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
            </View>

            {known && known.length > 0 && (
              <View className="gap-2">
                <Text className="font-semibold text-ink-muted text-[15px]">Suggested</Text>
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
          </>
        )}
      </ScrollView>
    </View>
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
    <Pressable onPress={onToggle} className="flex-row items-center gap-3">
      <View className="size-10 items-center justify-center rounded-full" style={{ backgroundColor: person.color }}>
        <Text className="text-center text-lg font-semibold text-on-avatar">{person.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text>{person.name}</Text>
        <Text className="text-[13px] text-ink-muted">{inCommon} in common</Text>
      </View>
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        accessibilityLabel={`Invite ${person.name}`}
      />
    </Pressable>
  );
}
