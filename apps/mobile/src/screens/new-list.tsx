import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import ListForm from '@/components/list-form';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@convex/_generated/api';
import { colors } from '@family-gifts/design-tokens';
import { zodResolver } from '@hookform/resolvers/zod';
import { ListInput, listSchema } from '@shared/schemas/list';

export default function NewList() {
  const router = useRouter();

  const { control, handleSubmit, formState, setError } = useForm<ListInput>({
    resolver: zodResolver(listSchema),
    defaultValues: { title: '', sharedWithGroupIds: [] },
  });

  const createList = useMutation(api.lists.create);

  const onSubmit = handleSubmit(async values => {
    try {
      const id = await createList(values);
      router.back();
      router.push({ pathname: '/(app)/(lists)/lists/[id]', params: { id } });
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
          disabled={formState.isSubmitting}
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
        <ListForm control={control} onSubmit={onSubmit} />
      </ScrollView>
    </View>
  );
}
