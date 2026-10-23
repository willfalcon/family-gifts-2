import { useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Image, Link, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  link: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  notes: z.string().optional(),
  price: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), { message: 'Price must be a positive number' }),
});

type ItemInput = z.infer<typeof itemSchema>;

export default function AddItem() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const listId = (Array.isArray(id) ? id[0] : id) as Id<'lists'>;

  const [isParsing, setIsParsing] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageId, setImageId] = useState<Id<'_storage'> | null>(null);

  const { control, handleSubmit, formState, setError, setValue, getValues } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', link: '', notes: '', price: '' },
  });

  const createItem = useMutation(api.items.create);
  const parseLinkAction = useAction(api.linkParser.parseLink);
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);

  const uploadImageFromUrl = useCallback(
    async (url: string) => {
      setIsUploadingImage(true);
      try {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(url);
        const blob = await response.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'image/jpeg' },
          body: blob,
        });

        if (!uploadResponse.ok) throw new Error('Upload failed');

        const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> };
        setImageUri(url);
        setImageId(storageId);
      } catch {
        // silently ignore image upload failures
      } finally {
        setIsUploadingImage(false);
      }
    },
    [generateUploadUrl],
  );

  const handleLinkBlur = useCallback(
    async (url: string) => {
      if (!url) return;
      try {
        new URL(url);
      } catch {
        return; // not a valid URL yet
      }

      setIsParsing(true);
      try {
        const result = await parseLinkAction({ url });

        if (result) {
          const current = getValues();
          if (!current.name && result.name) setValue('name', result.name);
          if (!current.notes && result.notes) setValue('notes', result.notes);
          if (!current.price && result.price != null) setValue('price', String(result.price));
          if (!imageUri && result.imageUrl) void uploadImageFromUrl(result.imageUrl);
        }
      } catch {
        // silently ignore parse failures
      } finally {
        setIsParsing(false);
      }
    },
    [parseLinkAction, getValues, setValue, imageUri, uploadImageFromUrl],
  );

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
      setImageUri(null);
      setImageId(null);
    } finally {
      setIsUploadingImage(false);
    }
  }, [generateUploadUrl]);

  const handleRemoveImage = useCallback(() => {
    setImageUri(null);
    setImageId(null);
  }, []);

  const onSubmit = handleSubmit(async values => {
    try {
      await createItem({
        listId,
        name: values.name,
        link: values.link || undefined,
        notes: values.notes || undefined,
        price: values.price ? parseFloat(values.price) : undefined,
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

        <Text className="flex-1 text-center text-lg font-bold">Add Item</Text>

        <GlassButton
          className="w-20"
          accessibilityLabel="Add item"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={() => onSubmit()}
          disabled={formState.isSubmitting || isParsing || isUploadingImage}
        >
          <Text className="font-semibold text-accent-foreground">Add</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Controller
          control={control}
          name="link"
          render={({ field, fieldState }) => (
            <View className="gap-1.5">
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
                onBlur={() => {
                  field.onBlur();
                  void handleLinkBlur(field.value ?? '');
                }}
                aria-invalid={!!fieldState.error}
              />
              {isParsing && (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Fetching item details...</Text>
                </View>
              )}
              {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
            </View>
          )}
        />

        <View className="gap-1.5">
          <Label nativeID="item-image">Photo (optional)</Label>
          {imageUri ? (
            <View className="relative h-32 w-32">
              <Pressable onPress={handlePickImage} accessibilityLabel="Change photo" style={{ flex: 1 }}>
                <ExpoImage
                  source={{ uri: imageUri }}
                  style={{ width: 128, height: 128, borderRadius: 12 }}
                  contentFit="cover"
                />
              </Pressable>
              {isUploadingImage && (
                <View className="absolute inset-0 items-center justify-center rounded-xl bg-background/60">
                  <ActivityIndicator size="small" />
                </View>
              )}
              <GlassButton
                className="absolute right-1 top-1 size-7 items-center justify-center rounded-full"
                onPress={handleRemoveImage}
                accessibilityLabel="Remove photo"
              >
                <Icon as={X} size={14} />
              </GlassButton>
            </View>
          ) : (
            <Pressable
              onPress={handlePickImage}
              accessibilityLabel="Add photo"
              className="h-32 w-32 items-center justify-center gap-2 rounded-xl bg-fill"
            >
              <Icon as={Image} size={24} className="text-ink-muted" />
              <Text className="text-sm text-ink-muted">Add photo</Text>
            </Pressable>
          )}
        </View>

        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <View className="gap-1.5">
              <Label nativeID="item-name">Name</Label>
              <Input
                aria-labelledby="item-name"
                placeholder="e.g. Blue wool sweater"
                autoFocus
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

        <Controller
          control={control}
          name="price"
          render={({ field, fieldState }) => (
            <View className="gap-1.5">
              <Label nativeID="item-price">Price (optional)</Label>
              <Input
                aria-labelledby="item-price"
                placeholder="0.00"
                keyboardType="decimal-pad"
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

        <Controller
          control={control}
          name="notes"
          render={({ field, fieldState }) => (
            <View className="gap-1.5">
              <Label nativeID="item-notes">Notes (optional)</Label>
              <Textarea
                aria-labelledby="item-notes"
                placeholder="Size, color, anything helpful..."
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
            </View>
          )}
        />
      </ScrollView>
    </View>
  );
}
