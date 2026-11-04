import { useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { DollarSign, Image, Link, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

const PRIORITIES = ['low', 'medium', 'high'] as const;
const IMAGE_SIZE = 72;

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Length of the text that was inserted between `prev` and `next` (ignoring the unchanged start and end).
function insertedLength(prev: string, next: string) {
  const min = Math.min(prev.length, next.length);
  let start = 0;
  while (start < min && prev[start] === next[start]) start++;
  let end = 0;
  while (end < min - start && prev[prev.length - 1 - end] === next[next.length - 1 - end]) end++;
  return next.length - start - end;
}

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  link: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  notes: z.string().optional(),
  price: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), { message: 'Price must be a positive number' }),
  priority: z.enum(PRIORITIES).optional(),
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
  const linkInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const lastParsedUrl = useRef<string | null>(null);
  const pastePending = useRef(false);

  const { control, handleSubmit, formState, setError, setValue, getValues } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', link: '', notes: '', price: '', priority: undefined },
  });

  const createItem = useMutation(api.items.create);
  const parseLinkAction = useAction(api.linkParser.parseLink);
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);

  const uploadImageFromUrl = useCallback(
    async (url: string, sourceLink: string) => {
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
        if (lastParsedUrl.current !== sourceLink) return; // a newer link replaced this one
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
      const fromPaste = pastePending.current;
      pastePending.current = false;
      if (!isValidUrl(url) || url === lastParsedUrl.current) return;

      // Pasting a new link over a previously fetched one replaces everything it filled in.
      const replace = fromPaste && lastParsedUrl.current !== null;
      lastParsedUrl.current = url;

      setIsParsing(true);
      try {
        const result = await parseLinkAction({ url });
        if (lastParsedUrl.current !== url) return; // a newer link replaced this one

        if (replace) {
          setValue('name', result?.name ?? '');
          setValue('notes', result?.notes ?? '');
          setValue('price', result?.price != null ? String(result.price) : '');
          setImageUri(null);
          setImageId(null);
          if (result?.imageUrl) void uploadImageFromUrl(result.imageUrl, url);
        } else if (result) {
          const current = getValues();
          if (!current.name && result.name) setValue('name', result.name);
          if (!current.notes && result.notes) setValue('notes', result.notes);
          if (!current.price && result.price != null) setValue('price', String(result.price));
          if (!imageUri && result.imageUrl) void uploadImageFromUrl(result.imageUrl, url);
        }
      } catch {
        // silently ignore parse failures
      } finally {
        if (lastParsedUrl.current === url) setIsParsing(false);
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
        priority: values.priority,
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
        contentContainerClassName="gap-2 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
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
                autoFocus
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                ref={linkInputRef}
                value={field.value}
                onChangeText={text => {
                  // RN has no paste event: treat inserting more than one character at once as a paste.
                  const pasted = insertedLength(field.value ?? '', text) > 1;
                  field.onChange(text);
                  // Blurring triggers onBlur, which starts the link check.
                  if (pasted && isValidUrl(text.trim())) {
                    pastePending.current = true;
                    linkInputRef.current?.blur();
                  }
                }}
                onBlur={() => {
                  field.onBlur();
                  void handleLinkBlur((getValues('link') ?? '').trim());
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

        <View className="mt-2 flex-row gap-2">
          {imageUri ? (
            <View className="relative" style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}>
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
      </ScrollView>
    </View>
  );
}
