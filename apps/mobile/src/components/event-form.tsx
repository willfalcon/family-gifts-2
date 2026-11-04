import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { ConvexError } from 'convex/values';
import { useRouter } from 'expo-router';
import { UserPlus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { DateField } from '@/components/date-field';
import GlassButton from '@/components/glass-button';
import { FieldRow } from '@/components/profile-form';
import { TimeField } from '@/components/time-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { guestKey, useEventDraft } from '@/hooks/event-draft';
import { useEvent } from '@/hooks/events';
import { useGroups } from '@/hooks/groups';
import { useSecretSanta } from '@/hooks/secret-santa-setup';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

// Create or edit an event, presented as a modal. Guests are only picked when
// creating; after that they're managed from the event screen.
export default function EventForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = id !== undefined;
  const event = useEvent(id);
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const inviteByEmail = useMutation(api.events.invite);
  const inviteUser = useMutation(api.events.inviteUser);
  const inviteGroup = useMutation(api.events.inviteGroup);
  const setSecretSantaOff = useMutation(api.secretSanta.setOff);
  const secretSanta = useSecretSanta(isEdit ? event?._id : undefined);
  // Once names are drawn it can't be turned off here: undo the draw first.
  const drawn = secretSanta?.exists === true && secretSanta.status !== 'draft';
  const groups = useGroups();
  // Who's been picked on the Add People screen. Only there for new events.
  const draft = useEventDraft();
  const people = draft?.guests ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [groupIds, setGroupIds] = useState<Id<'groups'>[]>([]);
  const [secretSantaOn, setSecretSantaOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fill the form once the event loads, and only once, so a live update
  // doesn't wipe what's being typed.
  const filled = useRef(false);
  useEffect(() => {
    if (!isEdit || !event || filled.current) return;
    filled.current = true;
    setName(event.name);
    setDescription(event.description ?? '');
    setLocation(event.location ?? '');
    setDate(event.date ?? '');
    const hasRange = !!event.endDate && event.endDate !== event.date;
    setMultiDay(hasRange);
    setEndDate(hasRange ? event.endDate! : '');
    setStartTime(event.startTime ?? '');
    setEndTime(event.endTime ?? '');
    setSecretSantaOn(!event.secretSantaOff);
  }, [isEdit, event]);

  // The event's fields, or an error message if the form isn't valid yet.
  function readFields(): { error: string } | { fields: FunctionArgs<typeof api.events.create> } {
    if (!name.trim()) return { error: 'Give your event a name' };
    if (multiDay && date && endDate && endDate < date) return { error: 'The end date is before the start date' };

    // update replaces every field, so anything left out is cleared.
    return {
      fields: {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        date: date || undefined,
        endDate: multiDay && endDate && endDate !== date ? endDate : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      },
    };
  }

  // Saves a new event before the form is done, so Add People can share its
  // invite link. From then on the form updates that event instead.
  useEffect(() => {
    if (!draft) return;
    draft.saveEvent.current = async () => {
      const result = readFields();
      if ('error' in result) {
        setError(result.error);
        return { error: result.error };
      }
      if (draft.eventId) {
        await updateEvent({ id: draft.eventId, ...result.fields });
        return { id: draft.eventId };
      }
      const newId = await createEvent(result.fields);
      draft.setEventId(newId);
      return { id: newId };
    };
  });

  async function onSubmit() {
    const result = readFields();
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const { fields } = result;

    setSubmitting(true);
    try {
      if (isEdit) {
        if (!event) return;
        const turningOff = !secretSantaOn && !event.secretSantaOff;
        const turningOn = secretSantaOn && !!event.secretSantaOff;
        // Turning it off throws away a setup that hasn't been drawn yet.
        if (turningOff && secretSanta?.exists && !(await confirmTurnOff())) {
          setSubmitting(false);
          return;
        }
        await updateEvent({ id: event._id, ...fields });
        if (turningOff || turningOn) await setSecretSantaOff({ eventId: event._id, off: turningOff });
        router.back();
      } else {
        let newId = draft?.eventId;
        if (newId) await updateEvent({ id: newId, ...fields });
        else newId = await createEvent(fields);
        const eventId = newId;
        // The event exists now, so a failed invite shouldn't block leaving the
        // form; say so and let them retry from the event screen.
        const results = await Promise.allSettled([
          ...groupIds.map(groupId => inviteGroup({ eventId, groupId })),
          ...people.map(person =>
            person.kind === 'user'
              ? inviteUser({ eventId, userId: person.userId })
              : inviteByEmail({ eventId, email: person.email }),
          ),
        ]);
        router.back();
        router.push({ pathname: '/(app)/(events)/events/[id]', params: { id: eventId } });
        if (results.some(r => r.status === 'rejected')) {
          Alert.alert('Some invites didn’t send', 'Your event was created. You can invite people again from its page.');
        }
      }
    } catch (e) {
      // ConvexError carries the server's validation message; anything else is unexpected.
      setError(e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  function confirmTurnOff() {
    return new Promise<boolean>(resolve =>
      Alert.alert('Turn off Secret Santa?', 'Who’s in, the keep-apart rules and the budget will be cleared.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Turn off', style: 'destructive', onPress: () => resolve(true) },
      ]),
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header stays pinned so Save is always reachable; the form below scrolls. */}
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Cancel">
          <Icon as={X} size={20} />
        </GlassButton>

        <Text className="flex-1 text-center text-lg font-bold">{isEdit ? 'Edit Event' : 'New Event'}</Text>

        <GlassButton
          className="w-20"
          accessibilityLabel={isEdit ? 'Save event' : 'Create event'}
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={onSubmit}
          disabled={submitting || (isEdit && !event)}
        >
          <Text className="font-semibold text-accent-foreground">{isEdit ? 'Save' : 'Create'}</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View className="gap-1.5">
          <Label nativeID="event-name">Name</Label>
          <Input
            aria-labelledby="event-name"
            placeholder="Christmas at Grandma's"
            autoFocus={!isEdit}
            returnKeyType="done"
            value={name}
            onChangeText={text => {
              setName(text);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
          />
          {error && <Text className="text-sm text-destructive">{error}</Text>}
        </View>

        <View className="gap-1.5">
          <Label nativeID="event-description">Description (optional)</Label>
          <Textarea
            aria-labelledby="event-description"
            className="bg-fill min-h-24"
            placeholder="Gift rules, spending limit..."
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View className="gap-2">
          <Label>Details</Label>
          <FieldRow>
            <Text>{multiDay ? 'Starts' : 'Date'}</Text>
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow>
            <Text>Multiple days</Text>
            <Switch aria-label="Multiple days" checked={multiDay} onCheckedChange={setMultiDay} />
          </FieldRow>
          {multiDay && (
            <FieldRow>
              <Text>Ends</Text>
              <DateField
                value={endDate}
                onChange={value => {
                  setEndDate(value);
                  if (error) setError(null);
                }}
              />
            </FieldRow>
          )}
          <FieldRow>
            <Text>Start time</Text>
            <TimeField aria-label="Start time" value={startTime} onChange={setStartTime} />
          </FieldRow>
          <FieldRow>
            <Text>End time</Text>
            <TimeField aria-label="End time" value={endTime} onChange={setEndTime} />
          </FieldRow>
          <View className="flex-row gap-3 border-b border-line pb-2">
            <Label nativeID="event-location" className="text-ink">
              Location
            </Label>
            <Textarea
              aria-labelledby="event-location"
              placeholder="Grandma's house"
              value={location}
              onChangeText={setLocation}
              className="flex-1"
            />
          </View>
        </View>

        {isEdit && (
          <View className="gap-2">
            <Label>Secret Santa</Label>
            <FieldRow>
              <Text>Secret Santa</Text>
              <Switch
                aria-label="Secret Santa"
                checked={secretSantaOn}
                onCheckedChange={setSecretSantaOn}
                disabled={drawn}
              />
            </FieldRow>
            <Text className="text-[13px] text-ink-muted">
              {drawn
                ? 'Names have been drawn. Undo the draw to turn Secret Santa off.'
                : secretSantaOn
                  ? 'Hosts can draw names from the event page.'
                  : 'Hosts won’t be asked to draw names for this event.'}
            </Text>
          </View>
        )}

        {!isEdit && (
          <View className="gap-2">
            <Label>Guests</Label>

            {groups && groups.length > 0 && (
              <View className="gap-1">
                <Text className="text-[13px] text-ink-muted font-semibold">Groups</Text>
                {groups.map(group => (
                  <View
                    key={group._id}
                    className="flex-row items-center justify-between gap-3 border-b border-line pb-2"
                  >
                    <View className="flex-1">
                      <Label className="text-[17px] text-ink" nativeID={`invite-group-${group._id}`}>
                        {group.name}
                      </Label>
                      <Text className="text-[13px] text-ink-muted">
                        {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
                      </Text>
                    </View>
                    <Switch
                      nativeID={`invite-group-${group._id}`}
                      checked={groupIds.includes(group._id)}
                      onCheckedChange={on =>
                        setGroupIds(ids => (on ? [...ids, group._id] : ids.filter(id => id !== group._id)))
                      }
                    />
                  </View>
                ))}
              </View>
            )}

            <View className="gap-1">
              <Text className="text-base text-ink font-normal">People</Text>
              {people.map(person => (
                <View
                  key={guestKey(person)}
                  className="flex-row items-center justify-between gap-3 border-b border-line pb-2 px-4"
                >
                  <View className="flex-1">
                    <Text>{person.name}</Text>
                    {person.kind === 'email' && person.name !== person.email && (
                      <Text className="text-[13px] text-ink-muted">{person.email}</Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => draft?.removeGuest(guestKey(person))}
                    accessibilityLabel={`Remove ${person.name}`}
                    className="size-8 items-center justify-center"
                  >
                    <Icon as={X} size={16} className="text-ink-muted" />
                  </Pressable>
                </View>
              ))}
              <Button
                variant="link"
                className="px-0 justify-start gap-2"
                onPress={() => router.push('/(app)/(events)/events/new/add-people')}
              >
                <Icon as={UserPlus} size={18} className="text-accent" />
                <Text className="text-accent font-normal">Add people</Text>
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
