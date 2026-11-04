import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useEffect, useRef } from 'react';

import GlassButton from '@/components/glass-button';
import ListForm from '@/components/list-form';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useGroups } from '@/hooks/groups';
import { useProfile } from '@/hooks/user';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';
import { zodResolver } from '@hookform/resolvers/zod';
import { ListInput, listSchema } from '@shared/schemas/list';

// Opening it with `eventId`, or `occasion=birthday`, starts the list for
// that occasion (as the Make a list To-do does).
function startingOccasion(params: { eventId?: string; occasion?: string }): ListInput['occasion'] {
  if (params.eventId) return { kind: 'event', eventId: params.eventId as Id<'events'> };
  if (params.occasion === 'birthday') return { kind: 'birthday' };
  return undefined;
}

export default function NewList() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string; occasion?: string }>();

  const { control, handleSubmit, formState, setError, resetField } = useForm<ListInput>({
    resolver: zodResolver(listSchema),
    defaultValues: { title: '', occasion: startingOccasion(params), sharedWithGroupIds: [] },
  });

  // Start "Who can see it?" from the profile's "Share new lists with" setting.
  // Both load after the form opens, so fill it in once they arrive - and only
  // once, so a later profile change doesn't undo what the user picked here.
  // Groups the user has since left are skipped; sharing with them would fail.
  const profile = useProfile();
  const groups = useGroups();
  const defaultsReady = profile !== undefined && groups !== undefined;
  const appliedDefaults = useRef(false);
  useEffect(() => {
    if (!defaultsReady || appliedDefaults.current) return;
    appliedDefaults.current = true;
    const myGroupIds = new Set(groups.map(g => g._id));
    const sharedWithGroupIds = (profile?.shareNewLists ?? []).filter(id => myGroupIds.has(id));
    resetField('sharedWithGroupIds', { defaultValue: sharedWithGroupIds });
  }, [defaultsReady, profile, groups, resetField]);

  const createList = useMutation(api.lists.create);

  const onSubmit = handleSubmit(async values => {
    try {
      const id = await createList(values);
      router.back();
      router.push({ pathname: '/(app)/(my-lists)/lists/[id]', params: { id } });
    } catch (e) {
      // ConvexError carries the server's validation message; anything else is unexpected.
      const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
      setError('title', { message });
    }
  });

  return (
    <View className="flex-1 bg-background">
      {/* Header stays pinned so Create is always reachable; the form below scrolls. */}
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Go back">
          <Icon as={X} size={20} />
        </GlassButton>

        <Text className="flex-1 text-center text-lg font-bold">New List</Text>

        <GlassButton
          className="w-20"
          accessibilityLabel="Create list"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={() => onSubmit()}
          // Wait for the sharing defaults, so a quick tap can't create an unshared list.
          disabled={formState.isSubmitting || !defaultsReady}
        >
          <Text className="font-semibold text-accent-foreground">Create</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <ListForm control={control} onSubmit={onSubmit} eventId={params.eventId} />
      </ScrollView>
    </View>
  );
}
