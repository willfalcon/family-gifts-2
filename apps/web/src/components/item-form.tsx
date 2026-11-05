import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAction, useMutation } from 'convex/react';
import { DollarSign, ImagePlus, Link as LinkIcon, Loader2, Minus, Plus, X } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { ItemWithImage } from '@convex/types';
import { ErrorText } from '@/components/auth-forms';
import { Label, SegmentedControl } from '@/components/ui/controls';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useLists } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

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
    .refine(v => !v || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0), { message: 'Quantity must be a positive number' }),
  listId: z.string().optional(),
});

type ItemInput = z.infer<typeof itemSchema>;

// Add or edit an idea on your own list. Adding fills in what it can from a
// pasted link (name, notes, price, photo); editing also sets the quantity and
// can move it to another list. Ported from mobile's add-item and edit-item.
export function ItemForm({
  formId,
  listId,
  item,
  initialLink,
  onDone,
  onBusyChange,
}: {
  formId: string;
  listId: Id<'lists'>;
  // Leave out to add a new idea.
  item?: ItemWithImage;
  initialLink?: string;
  onDone: () => void;
  // So the page's Save button can wait for link parsing and uploads.
  onBusyChange: (busy: boolean) => void;
}) {
  const isEdit = !!item;
  const lists = useLists();
  const createItem = useMutation(api.items.create);
  const updateItem = useMutation(api.items.update);
  const parseLink = useAction(api.linkParser.parseLink);
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);

  const [isParsing, setIsParsing] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(item?.imageUrl ?? null);
  const [imageId, setImageId] = useState<Id<'_storage'> | null>(item?.imageId ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const lastParsedUrl = useRef<string | null>(item?.link ?? null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { control, handleSubmit, formState, setError, setValue, getValues } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: item?.name ?? '',
      link: item?.link ?? '',
      notes: item?.notes ?? '',
      price: item?.price != null ? String(item.price) : '',
      priority: item?.priority ?? undefined,
      quantity: item?.quantity != null ? String(item.quantity) : '1',
      listId: item?.listId ?? listId,
    },
  });

  useEffect(() => onBusyChange(formState.isSubmitting || isParsing || isUploading), [formState.isSubmitting, isParsing, isUploading]);

  const upload = useCallback(
    async (blob: Blob) => {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      });
      if (!res.ok) throw new Error('Upload failed');
      return ((await res.json()) as { storageId: Id<'_storage'> }).storageId;
    },
    [generateUploadUrl],
  );

  // A store's product photo. Fetched in the browser, so a site that blocks
  // cross-origin requests just means no photo, same as a failed fetch on mobile.
  const uploadFromUrl = useCallback(
    async (url: string, sourceLink: string) => {
      setIsUploading(true);
      try {
        const blob = await (await fetch(url)).blob();
        const storageId = await upload(blob);
        if (lastParsedUrl.current !== sourceLink) return; // a newer link replaced this one
        setImageUri(url);
        setImageId(storageId);
      } catch {
        // Silently skip: the idea is fine without a photo.
      } finally {
        setIsUploading(false);
      }
    },
    [upload],
  );

  // Fills in the rest of the form from a link. Pasting a new link over one
  // that was already fetched replaces everything it filled in.
  const handleLink = useCallback(
    async (url: string, fromPaste: boolean) => {
      if (!isValidUrl(url) || url === lastParsedUrl.current) return;
      const replace = fromPaste && lastParsedUrl.current !== null;
      lastParsedUrl.current = url;
      setIsParsing(true);
      try {
        const result = await parseLink({ url });
        if (lastParsedUrl.current !== url) return;
        if (replace) {
          setValue('name', result?.name ?? '');
          setValue('notes', result?.notes ?? '');
          setValue('price', result?.price != null ? String(result.price) : '');
          setImageUri(null);
          setImageId(null);
          if (result?.imageUrl) void uploadFromUrl(result.imageUrl, url);
        } else if (result) {
          const current = getValues();
          if (!current.name && result.name) setValue('name', result.name);
          if (!current.notes && result.notes) setValue('notes', result.notes);
          if (!current.price && result.price != null) setValue('price', String(result.price));
          if (!imageId && result.imageUrl) void uploadFromUrl(result.imageUrl, url);
        }
      } catch {
        // Silently skip: the form can be filled in by hand.
      } finally {
        if (lastParsedUrl.current === url) setIsParsing(false);
      }
    },
    [parseLink, getValues, setValue, imageId, uploadFromUrl],
  );

  // Opened from "Paste a link": start with that link.
  const startedWithLink = useRef(false);
  useEffect(() => {
    if (!initialLink || startedWithLink.current || isEdit) return;
    startedWithLink.current = true;
    if (isValidUrl(initialLink)) {
      setValue('link', initialLink);
      void handleLink(initialLink, false);
    } else {
      setValue('name', initialLink.slice(0, 200));
    }
  }, [initialLink]);

  async function pickImage(file: File) {
    const previous = { uri: imageUri, id: imageId };
    setImageUri(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      setImageId(await upload(file));
    } catch {
      setImageUri(previous.uri);
      setImageId(previous.id);
    } finally {
      setIsUploading(false);
    }
  }

  const onSubmit = handleSubmit(async values => {
    const fields = {
      name: values.name,
      link: values.link || undefined,
      notes: values.notes || undefined,
      price: values.price ? parseFloat(values.price) : undefined,
      priority: values.priority,
      imageId: imageId ?? undefined,
    };
    try {
      if (item) {
        await updateItem({
          id: item._id,
          ...fields,
          quantity: values.quantity ? parseInt(values.quantity, 10) : undefined,
          listId: values.listId && values.listId !== item.listId ? (values.listId as Id<'lists'>) : undefined,
        });
      } else {
        await createItem({ listId, ...fields });
      }
      onDone();
    } catch (e) {
      setError('name', { message: errorMessage(e) });
    }
  });

  return (
    <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-3">
      <Controller
        control={control}
        name="link"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-link">Link</Label>
            <Input
              id="item-link"
              prepend={LinkIcon}
              type="url"
              inputMode="url"
              placeholder="https://..."
              autoFocus={!isEdit}
              {...field}
              onPaste={e => {
                const text = e.clipboardData.getData('text').trim();
                if (isValidUrl(text)) {
                  e.preventDefault();
                  field.onChange(text);
                  void handleLink(text, true);
                }
              }}
              onBlur={() => {
                field.onBlur();
                void handleLink((getValues('link') ?? '').trim(), false);
              }}
              aria-invalid={!!fieldState.error}
            />
            {isParsing && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Fetching item details...
              </p>
            )}
            <ErrorText>{fieldState.error?.message}</ErrorText>
          </div>
        )}
      />

      <div className="mt-2 flex gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void pickImage(file);
            e.target.value = '';
          }}
        />
        {imageUri ? (
          <div className="relative shrink-0" style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}>
            <button type="button" onClick={() => fileInput.current?.click()} aria-label="Change photo" className="size-full">
              <img src={imageUri} alt="" className="size-full rounded-2xl object-cover" />
            </button>
            {isUploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60">
                <Loader2 className="size-5 animate-spin" />
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setImageUri(null);
                setImageId(null);
              }}
              aria-label="Remove photo"
              className="glass absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Add photo"
            className="flex shrink-0 items-center justify-center rounded-xl bg-fill hover:bg-line"
            style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
          >
            {isUploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-6 text-ink-muted" />}
          </button>
        )}
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" placeholder="e.g. Blue wool sweater" {...field} aria-invalid={!!fieldState.error} />
              <ErrorText>{fieldState.error?.message}</ErrorText>
            </div>
          )}
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-ink-muted">Details</p>

      <Controller
        control={control}
        name="price"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1 border-b border-line pb-2">
            <div className="flex items-center gap-3">
              <label htmlFor="item-price" className="w-20 shrink-0">
                Price
              </label>
              <Input
                id="item-price"
                prepend={DollarSign}
                inputMode="decimal"
                placeholder="Optional"
                className="bg-transparent"
                {...field}
                aria-invalid={!!fieldState.error}
              />
            </div>
            <ErrorText>{fieldState.error?.message}</ErrorText>
          </div>
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <div className="flex items-start gap-3 border-b border-line pb-2">
            <label htmlFor="item-notes" className="w-20 shrink-0 pt-2">
              Notes
            </label>
            <Textarea id="item-notes" placeholder="Size, color, anything helpful..." {...field} />
          </div>
        )}
      />

      <Controller
        control={control}
        name="priority"
        render={({ field }) => (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
            <span id="item-priority">Priority</span>
            <SegmentedControl
              aria-label="Priority"
              options={PRIORITIES.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))}
              value={field.value ?? null}
              onChange={field.onChange}
            />
          </div>
        )}
      />

      {isEdit && (
        <>
          <Controller
            control={control}
            name="quantity"
            render={({ field, fieldState }) => {
              const parsed = parseInt(field.value ?? '', 10);
              const current = isNaN(parsed) ? 1 : parsed;
              return (
                <div className="flex flex-col gap-1 border-b border-line pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="item-quantity">Quantity</label>
                    <div className="flex items-center gap-1 rounded-md bg-fill">
                      <button
                        type="button"
                        onClick={() => field.onChange(String(Math.max(1, current - 1)))}
                        className="flex size-9 items-center justify-center"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-4" />
                      </button>
                      <Input
                        id="item-quantity"
                        inputMode="numeric"
                        className="w-14 text-center"
                        {...field}
                        aria-invalid={!!fieldState.error}
                      />
                      <button
                        type="button"
                        onClick={() => field.onChange(String(current + 1))}
                        className="flex size-9 items-center justify-center"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                  <ErrorText>{fieldState.error?.message}</ErrorText>
                </div>
              );
            }}
          />
          <Controller
            control={control}
            name="listId"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <label htmlFor="item-list">List</label>
                <Select id="item-list" value={field.value} onChange={e => field.onChange(e.target.value)}>
                  {(lists ?? []).map(l => (
                    <option key={l._id} value={l._id}>
                      {l.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          />
        </>
      )}
    </form>
  );
}
