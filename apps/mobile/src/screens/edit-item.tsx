import { useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { tag, tint } from '@expo/ui/swift-ui/modifiers';
import { DollarSign, Image, Link, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useItems, useLists } from '@/hooks/lists';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

const PRIORITIES = ['low', 'medium', 'high'] as const;
const IMAGE_SIZE = 72;

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  link: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  notes: z.string().optional(),
  price: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), { message: 'Price must be a positive number' }),
  priority: z.enum(PRIORITIES).optional(),
  quantity: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0), {
      message: 'Quantity must be a positive number',
    }),
  listId: z.string().min(1, 'List is required'),
});

type ItemInput = z.infer<typeof itemSchema>;

export default function EditItem() {
  const router = useRouter();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const listId = id as Id<'lists'>;

  const items = useItems(listId);
  const item = items?.find(i => i._id === itemId);
  const lists = useLists();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageId, setImageId] = useState<Id<'_storage'> | null | undefined>(undefined);

  const { control, handleSubmit, formState, setError, reset } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', link: '', notes: '', price: '', priority: undefined, quantity: '1', listId: '' },
  });

  // Pre-populate form once item loads
  useEffect(() => {
    if (!item) return;
    reset({
      name: item.name,
      link: item.link ?? '',
      notes: item.notes ?? '',
      price: item.price != null ? String(item.price) : '',
      priority: item.priority ?? undefined,
      quantity: item.quantity != null ? String(item.quantity) : '1',
      listId: item.listId,
    });
    setImageUri(item.imageUrl ?? null);
    setImageId(item.imageId ?? null);
  }, [item?._id]);

  const updateItem = useMutation(api.items.update);
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setIsUploadingImage(true);

    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': asset.mimeType ?? 'image/jpeg' },
        body: blob,
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');

      const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> };
      setImageId(storageId);
    } catch {
      setImageUri(item?.imageUrl ?? null);
      setImageId(item?.imageId ?? null);
    } finally {
      setIsUploadingImage(false);
    }
  }, [generateUploadUrl, item]);

  const handleRemoveImage = useCallback(() => {
    setImageUri(null);
    setImageId(null);
  }, []);

  const onSubmit = handleSubmit(async values => {
    if (!item) return;
    try {
      await updateItem({
        id: item._id,
        name: values.name,
        link: values.link || undefined,
        notes: values.notes || undefined,
        price: values.price ? parseFloat(values.price) : undefined,
        priority: values.priority,
        quantity: values.quantity ? parseInt(values.quantity, 10) : undefined,
        listId: values.listId !== item.listId ? (values.listId as Id<'lists'>) : undefined,
        imageId: imageId ?? undefined,
      });
      router.back();
    } catch (e) {
      const message = e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.';
      setError('name', { message });
    }
  });

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Cancel">
          <Icon as={X} size={20} />
        </GlassButton>

        <Text className="flex-1 text-center text-lg font-bold">Edit Item</Text>

        <GlassButton
          className="w-20"
          accessibilityLabel="Save item"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={() => onSubmit()}
          disabled={formState.isSubmitting || isUploadingImage || !item}
        >
          <Text className="font-semibold text-accent-foreground">Save</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View className="flex-row gap-2">
          {imageUri ? (
            <View
              className="relative"
              style={{
                width: IMAGE_SIZE,
                height: IMAGE_SIZE,
              }}
            >
              <Pressable onPress={handlePickImage} accessibilityLabel="Change photo" style={{ flex: 1 }}>
                <ExpoImage
                  source={{ uri: imageUri }}
                  style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 16 }}
                  contentFit="cover"
                />
              </Pressable>
              {isUploadingImage && (
                <View className="absolute inset-0 items-center justify-center rounded-xl bg-background/60">
                  <ActivityIndicator size="small" />
                </View>
              )}
              <GlassButton
                className="absolute bottom-1 right-1 items-center justify-center rounded-full"
                onPress={handleRemoveImage}
                accessibilityLabel="Remove photo"
                glassProps={{
                  style: { width: 20, height: 20, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
                }}
              >
                <Icon as={X} size={14} />
              </GlassButton>
            </View>
          ) : (
            <Pressable
              onPress={handlePickImage}
              accessibilityLabel="Add photo"
              className="items-center justify-center gap-2 rounded-xl bg-fill"
              style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
            >
              <Icon as={Image} size={24} className="text-ink-muted" />
            </Pressable>
          )}

          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <View className="flex-1 gap-1.5">
                <Label nativeID="item-name">Name</Label>
                <Input
                  aria-labelledby="item-name"
                  placeholder="e.g. Blue wool sweater"
                  returnKeyType="next"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="link"
          render={({ field, fieldState }) => (
            <View className="gap-1.5">
              <Label nativeID="item-link">Link</Label>
              <Input
                prepend={Link}
                aria-labelledby="item-link"
                placeholder="https://..."
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
            </View>
          )}
        />

        <Text className="mt-4 text-sm font-semibold text-ink-muted">Details</Text>

        <Controller
          control={control}
          name="price"
          render={({ field, fieldState }) => (
            <View className="flex-row gap-1.5 border-b border-line">
              <Label nativeID="item-price" className="text-ink">
                Price
              </Label>
              <Input
                aria-labelledby="item-price"
                placeholder="Optional"
                keyboardType="decimal-pad"
                returnKeyType="next"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!fieldState.error}
                prepend={DollarSign}
                className="bg-transparent"
              />
              {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field, fieldState }) => (
            <View className="flex-row gap-3 border-b border-line pb-2">
              <Label nativeID="item-notes" className="text-ink">
                Notes
              </Label>
              <Textarea
                aria-labelledby="item-notes"
                placeholder="Size, color, anything helpful..."
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!fieldState.error}
                className="flex-1"
              />
              {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <View className="flex-row justify-between gap-1.5 border-b border-line pb-2">
              <Label nativeID="item-priority" className="text-ink">
                Priority
              </Label>
              <SegmentedControl
                options={PRIORITIES.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))}
                value={field.value ?? null}
                onChange={field.onChange}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="quantity"
          render={({ field, fieldState }) => {
            const numVal = parseInt(field.value ?? '', 10);
            const current = isNaN(numVal) ? 1 : numVal;
            return (
              <View className="gap-1.5 border-b border-line pb-2">
                <View className="flex-row items-center gap-1.5">
                  <Label nativeID="item-quantity" className="text-ink">
                    Quantity
                  </Label>
                  <View className="ml-auto flex-row items-center gap-2 rounded-md bg-fill">
                    <Pressable
                      onPress={() => field.onChange(String(Math.max(1, current - 1)))}
                      className="h-9 w-9 items-center justify-center"
                      accessibilityLabel="Decrease quantity"
                    >
                      <Text className="text-lg font-semibold leading-none">−</Text>
                    </Pressable>
                    <Input
                      aria-labelledby="item-quantity"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={!!fieldState.error}
                      className="w-14 text-center"
                    />
                    <Pressable
                      onPress={() => field.onChange(String(current + 1))}
                      className="h-9 w-9 items-center justify-center"
                      accessibilityLabel="Increase quantity"
                    >
                      <Text className="text-lg font-semibold leading-none">+</Text>
                    </Pressable>
                  </View>
                </View>
                {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
              </View>
            );
          }}
        />

        <Controller
          control={control}
          name="listId"
          render={({ field, fieldState }) => (
            <View className="flex-row justify-between gap-1.5 border-b border-line pb-2">
              <Label nativeID="item-list" className="text-ink">
                List
              </Label>
              <Host matchContents style={{ alignSelf: 'stretch' }}>
                <Picker
                  label="List"
                  selection={field.value || null}
                  onSelectionChange={val => field.onChange(val ?? '')}
                  modifiers={[tint(colors['ink-muted'])]}
                >
                  {(lists ?? []).map(l => (
                    <SwiftText key={l._id} modifiers={[tag(l._id)]}>
                      {l.title}
                    </SwiftText>
                  ))}
                </Picker>
              </Host>
              {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
            </View>
          )}
        />
      </ScrollView>
    </View>
  );
}
