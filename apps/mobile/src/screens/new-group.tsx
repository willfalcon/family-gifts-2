import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { FieldRow } from '@/components/profile-form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useLists } from '@/hooks/lists';
import { occasionParts } from '@/lib/occasion';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';
import { plural } from '@shared/utils';

export default function NewGroup() {
  const router = useRouter();
  const lists = useLists();
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState('');
  const [membersCanInvite, setMembersCanInvite] = useState(false);
  const [sharedListIds, setSharedListIds] = useState<Id<'lists'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleList(listId: Id<'lists'>, checked: boolean) {
    setSharedListIds(ids => (checked ? [...ids, listId] : ids.filter(id => id !== listId)));
  }

  async function onSubmit() {
    if (!name.trim()) {
      setError('Give your group a name');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createGroup({ name, membersCanInvite, sharedListIds });
      router.back();
      router.push({ pathname: '/(app)/(groups)/groups/[id]', params: { id } });
    } catch (e) {
      // ConvexError carries the server's validation message; anything else is unexpected.
      setError(e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header stays pinned so Create is always reachable; the form below scrolls. */}
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Cancel">
          <Icon as={X} size={20} />
        </GlassButton>

        <Text className="flex-1 text-center text-lg font-bold">New Group</Text>

        <GlassButton
          className="w-20"
          accessibilityLabel="Create group"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text className="font-semibold text-accent-foreground">Create</Text>
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
          <Label nativeID="group-name">Name</Label>
          <Input
            aria-labelledby="group-name"
            placeholder="Smith Family, Book Club"
            autoFocus
            returnKeyType="done"
            value={name}
            onChangeText={text => {
              setName(text);
              if (error) setError(null);
            }}
            onSubmitEditing={onSubmit}
            aria-invalid={!!error}
          />
          {error && <Text className="text-sm text-destructive">{error}</Text>}
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-ink-muted text-[15px]">Joining</Text>
          <FieldRow>
            <Text>Members can invite</Text>
            <Switch aria-label="Members can invite" checked={membersCanInvite} onCheckedChange={setMembersCanInvite} />
          </FieldRow>
          <Text className="text-[13px] text-ink-muted">
            {membersCanInvite
              ? 'Anyone in the group can share the invite link. People join right away. You can change this later.'
              : 'Only managers can share the invite link. People join right away. You can change this later.'}
          </Text>
        </View>

        {lists && lists.length > 0 && (
          <View className="gap-2">
            <Text className="font-semibold text-ink-muted text-[15px]">Share your lists</Text>
            {lists.map(list => {
              const checked = sharedListIds.includes(list._id);
              // e.g. "12 ideas · Christmas party · Dec 15"
              const summary = [plural(list.itemCount, 'idea'), ...occasionParts(list, 'My birthday')].join(' · ');
              return (
                // The whole row is tappable, not just the switch.
                <Pressable key={list._id} onPress={() => toggleList(list._id, !checked)}>
                  <FieldRow>
                    <View className="flex-1">
                      <Text>{list.title}</Text>
                      <Text className="text-[13px] text-ink-muted">{summary}</Text>
                    </View>
                    <Switch
                      aria-label={list.title}
                      checked={checked}
                      onCheckedChange={value => toggleList(list._id, value)}
                    />
                  </FieldRow>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
