import { router } from 'expo-router';
import { Ampersand, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { FieldRow } from '@/components/profile-form';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useSecretSantaSetup, type SetupPerson } from '@/hooks/secret-santa-setup';
import { PersonAvatar, statusLabel } from '@/screens/secret-santa-setup';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

type AttendeeId = Id<'eventAttendees'>;

// Picks two people from the draw who shouldn't draw each other. Opened from
// the Secret Santa sheet; Add hands the pair back to it.
export default function KeepApart() {
  const { options, picked, addRule } = useSecretSantaSetup();
  const [first, setFirst] = useState<AttendeeId>();
  const [second, setSecond] = useState<AttendeeId>();
  const [remember, setRemember] = useState(false);

  const inDraw = (options?.people ?? []).filter(p => picked.includes(p.attendeeId));
  const byId = new Map(inDraw.map(p => [p.attendeeId as string, p]));

  // The first two taps fill the cards. After that a tap replaces the second
  // person, and tapping someone already picked takes them out.
  function tap(id: AttendeeId) {
    if (id === first) {
      setFirst(second);
      setSecond(undefined);
    } else if (id === second) {
      setSecond(undefined);
    } else if (!first) {
      setFirst(id);
    } else {
      setSecond(id);
    }
  }

  // "Remember" saves the pair on a group both are in. Before both are picked,
  // the first invited group stands in.
  const groups = options?.groups ?? [];
  const sharedGroup =
    first && second ? groups.find(g => g.attendeeIds.includes(first) && g.attendeeIds.includes(second)) : groups[0];

  function add() {
    if (!first || !second) return;
    addRule({ a: first, b: second, rememberForGroupId: remember ? sharedGroup?.groupId : undefined });
    router.back();
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Cancel">
          <Icon as={X} size={20} />
        </GlassButton>
        <Text className="flex-1 text-center text-lg font-bold">Keep Apart</Text>
        <GlassButton
          className="w-20"
          accessibilityLabel="Add rule"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          disabled={!first || !second}
          style={{ opacity: first && second ? 1 : 0.5 }}
          onPress={add}
        >
          <Text className="font-semibold text-accent-foreground">Add</Text>
        </GlassButton>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-4 pb-8">
        <View className="gap-4">
          <View className="flex-row items-center gap-3">
            <PickCard person={first ? byId.get(first) : undefined} />
            <Icon as={Ampersand} size={32} className="text-ink-muted" />
            <PickCard person={second ? byId.get(second) : undefined} />
          </View>
          <Text className="text-center text-[15px] text-ink-muted">
            They won’t draw each other, in either direction.
          </Text>
          <View className="rounded-xl bg-fill p-3">
            <Text className="text-[14px] text-ink">Pick two people. Tap someone again to take them out.</Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-ink-muted text-[15px]">Everyone in the draw</Text>
          <View>
            {inDraw.map(person => {
              const order = person.attendeeId === first ? 1 : person.attendeeId === second ? 2 : null;
              return (
                <Pressable
                  key={person.attendeeId}
                  onPress={() => tap(person.attendeeId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: order !== null }}
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
                  <OrderCheck order={order} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {sharedGroup && (
          <FieldRow>
            <View className="flex-1">
              <Text>Remember for {sharedGroup.name}</Text>
              <Text className="text-footnote text-ink-muted">Suggest this pair in future draws</Text>
            </View>
            <Switch aria-label={`Remember for ${sharedGroup.name}`} checked={remember} onCheckedChange={setRemember} />
          </FieldRow>
        )}
      </ScrollView>
    </View>
  );
}

function PickCard({ person }: { person: SetupPerson | undefined }) {
  return (
    <View className="h-36 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card p-3">
      {person ? (
        <>
          <PersonAvatar person={person} size={48} />
          <Text className="text-center font-semibold" numberOfLines={1}>
            {person.name}
          </Text>
        </>
      ) : (
        <>
          <View className="size-12 items-center justify-center rounded-full border-2 border-accent">
            <Icon as={Plus} size={22} className="text-accent" />
          </View>
          <Text className="text-center text-ink-muted">Pick someone</Text>
        </>
      )}
    </View>
  );
}

// Like the app's round checkbox, but shows which card the person went into.
function OrderCheck({ order }: { order: 1 | 2 | null }) {
  return (
    <View
      className={
        order
          ? 'size-6 items-center justify-center rounded-full border border-accent bg-accent'
          : 'size-6 rounded-full border border-input bg-background'
      }
    >
      {order && <Text className="text-[13px] font-bold text-primary-foreground">{order}</Text>}
    </View>
  );
}
