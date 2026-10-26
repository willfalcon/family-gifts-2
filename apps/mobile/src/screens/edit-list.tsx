import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import ListForm from '@/components/list-form';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useList, useListShares } from '@/hooks/lists';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';
import { zodResolver } from '@hookform/resolvers/zod';
import { ListInput, listSchema } from '@shared/schemas/list';

export default function EditList() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id as Id<'lists'>;

  const list = useList(listId);
  const listShares = useListShares(listId);

  const { control, handleSubmit, formState, setError, reset } = useForm<ListInput>({
    resolver: zodResolver(listSchema),
    defaultValues: { title: '', sharedWithGroupIds: [] },
  });

  useEffect(() => {
    if (list && listShares !== undefined) {
      reset({
        title: list.title,
        occasion: list.occasion,
        sharedWithGroupIds: listShares
          .filter(s => s.kind === 'group')
          .map(s => s.groupId),
      });
    }
  }, [list, listShares]);

  const updateList = useMutation(api.lists.update);

  const onSubmit = handleSubmit(async values => {
    try {
      await updateList({ id: listId, ...values });
      router.back();
    } catch (e) {
      // ConvexError carries the server's validation message; anything else is unexpected.
      const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
      setError('title', { message });
    }
  });

  return (
    <View className="flex-1 bg-background">
      {/* Header stays pinned so Save is always reachable; the form below scrolls. */}
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Go back">
          <Icon as={X} size={20} />
        </GlassButton>

        <Text className="flex-1 text-center text-lg font-bold">Edit List</Text>

        <GlassButton
          className="w-20"
          accessibilityLabel="Save list"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={() => onSubmit()}
          disabled={formState.isSubmitting || !list}
        >
          <Text className="font-semibold text-accent-foreground">Save</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <ListForm control={control} onSubmit={onSubmit} />
      </ScrollView>
    </View>
  );
}
