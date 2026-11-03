import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { format, parseISO } from 'date-fns';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import GlassButton from '@/components/glass-button';
import { FieldRow } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { localToday, useEvent } from '@/hooks/events';
import { useSecretSantaSetup, type SetupPerson } from '@/hooks/secret-santa-setup';
import { api } from '@convex/_generated/api';
import { colors } from '@family-gifts/design-tokens';
import { formatShortDate, formatWhen } from '@shared/event-dates';

// Scheduled draws happen at this hour, local time, on the chosen day.
const DRAW_HOUR = 9;

export function statusLabel(person: SetupPerson) {
  if (person.status === 'declined') return 'Not going';
  if (person.status === 'invited') return 'Hasn’t replied';
  return person.role === 'guest' ? 'Going' : 'Host';
}

export function firstName(name: string) {
  return name.split(/\s+/)[0] || name;
}

// "Mom", "Mom and Uncle Ray", "Mom, Uncle Ray, and Sue".
function joinNames(names: string[]) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function PersonAvatar({ person, size = 40 }: { person: Pick<SetupPerson, 'name' | 'color'>; size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: person.color }}
    >
      <Text className="font-semibold text-on-avatar" style={{ fontSize: size * 0.45 }}>
        {person.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// Sets up Secret Santa for an event: who's in, the budget, who to keep
// apart, and when names get drawn. Hosts only.
export default function SecretSantaSetup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inGroupsTab = useSegments().includes('(groups)');
  const event = useEvent(id);
  const setup = useSecretSantaSetup();
  const { options, picked, togglePicked, budget, setBudget, rules, removeRule, drawDate, setDrawDate, drawEarly, setDrawEarly } =
    setup;
  const createSecretSanta = useMutation(api.secretSanta.setup);
  const [submitting, setSubmitting] = useState(false);

  const people = options?.people ?? [];
  const byId = new Map(people.map(p => [p.attendeeId as string, p]));
  const drawNow = !drawDate;
  const today = localToday();

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
      Alert.alert('Check the spending limit', 'Enter an amount like 25.');
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
        drawAt,
        drawEarly,
      });
      router.back();
    } catch (e) {
      Alert.alert(
        drawNow ? 'Couldn’t draw names' : 'Couldn’t set up Secret Santa',
        e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.',
      );
      setSubmitting(false);
    }
  }

  const keepApartHref = {
    pathname: inGroupsTab
      ? '/(app)/(groups)/events/[id]/secret-santa/keep-apart'
      : '/(app)/(events)/events/[id]/secret-santa/keep-apart',
    params: { id },
  } as const;

  const drawFootnote = drawNow
    ? `Names are drawn as soon as you tap Draw.${
        leftOut.length > 0
          ? ` Only people going are in, so ${joinNames(leftOut.map(p => p.name))} won’t be included.`
          : ''
      }`
    : `Names are drawn on ${format(parseISO(drawDate), 'EEE, MMM d')}${
        drawEarly ? ', or sooner if everyone replies first' : ''
      }. Everyone gets a notification.`;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Cancel">
          <Icon as={X} size={20} />
        </GlassButton>
        <View className="flex-1 items-center">
          <Text className="text-center text-lg font-bold">Secret Santa</Text>
          {event && (
            <Text className="text-center text-footnote text-ink-muted" numberOfLines={1}>
              {event.name}
              {(event.date || event.startTime) &&
                ` · ${event.date ? formatShortDate(event.date, event.startTime) : formatWhen(event)}`}
            </Text>
          )}
        </View>
        <GlassButton
          className="w-20"
          accessibilityLabel={drawNow ? 'Draw names' : 'Save Secret Santa'}
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          disabled={submitting || !event || picked.length < 2}
          onPress={submit}
        >
          <Text className="font-semibold text-accent-foreground">{drawNow ? 'Draw' : 'Save'}</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View className="gap-2">
          <View>
            {people.map(person => {
              const checked = picked.includes(person.attendeeId);
              return (
                <Pressable
                  key={person.attendeeId}
                  onPress={() => togglePicked(person.attendeeId)}
                  className="flex-row items-center gap-3 border-b border-line py-2"
                >
                  <PersonAvatar person={person} />
                  <View className="flex-1">
                    <Text>
                      {person.name}
                      {person.isMe && <Text className="text-ink-muted"> (you)</Text>}
                    </Text>
                    <Text className="text-footnote text-ink-muted">{statusLabel(person)}</Text>
                  </View>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePicked(person.attendeeId)}
                    accessibilityLabel={`Include ${person.name}`}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text className="text-footnote text-ink-muted">
            People who haven’t replied join the draw if they accept before names are drawn.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-ink-muted text-[15px]">Budget</Text>
          <FieldRow>
            <Text nativeID="spending-limit">Spending limit</Text>
            <View className="h-10 w-32 flex-row items-center rounded-md bg-fill px-3">
              <Text className="text-ink-muted">$</Text>
              <TextInput
                aria-labelledby="spending-limit"
                className="flex-1 pl-1 text-base leading-5 text-ink"
                placeholder="0"
                placeholderTextColor={colors['muted-foreground']}
                keyboardType="decimal-pad"
                returnKeyType="done"
                value={budget}
                onChangeText={setBudget}
              />
            </View>
          </FieldRow>
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-ink-muted text-[15px]">Rules</Text>
          {rules.map(rule => {
            const a = byId.get(rule.a);
            const b = byId.get(rule.b);
            if (!a || !b) return null;
            return (
              <View key={`${rule.a}-${rule.b}`} className="flex-row items-center gap-3 border-b border-line py-2">
                <View className="flex-row">
                  <View className="rounded-full border-2 border-background">
                    <PersonAvatar person={a} size={32} />
                  </View>
                  <View className="-ml-3 rounded-full border-2 border-background">
                    <PersonAvatar person={b} size={32} />
                  </View>
                </View>
                <Text className="flex-1">
                  {firstName(a.name)} &amp; {firstName(b.name)}
                </Text>
                <Pressable
                  onPress={() => removeRule(rule)}
                  hitSlop={8}
                  accessibilityLabel={`Remove rule for ${a.name} and ${b.name}`}
                  className="size-8 items-center justify-center"
                >
                  <Icon as={X} size={18} className="text-ink-muted" />
                </Pressable>
              </View>
            );
          })}
          <Button
            variant="link"
            className="justify-start gap-2 px-0"
            disabled={picked.length < 2}
            onPress={() => router.push(keepApartHref)}
          >
            <Icon as={Plus} size={18} className="text-accent" />
            <Text className="font-normal text-accent">Keep two people apart</Text>
          </Button>
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-ink-muted text-[15px]">When to draw</Text>
          <FieldRow>
            <Text>Draw names</Text>
            <DateField value={drawDate} onChange={pickDrawDate} emptyLabel="Now" minimumDate={parseISO(today)} />
          </FieldRow>
          {!drawNow && (
            <FieldRow>
              <View className="flex-1">
                <Text>Draw early if everyone replies</Text>
                <Text className="text-footnote text-ink-muted">As soon as the last person answers</Text>
              </View>
              <Switch aria-label="Draw early if everyone replies" checked={drawEarly} onCheckedChange={setDrawEarly} />
            </FieldRow>
          )}
          <Text className="text-footnote text-ink-muted">{drawFootnote}</Text>
          <Text className="text-footnote text-ink-muted">
            Nobody sees who drew whom, not even hosts. Each person only sees their own match, and gets a notification
            when names are drawn.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
