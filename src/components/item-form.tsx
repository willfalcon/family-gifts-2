import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mirrors the `items` table in convex/schema.ts. Every field is kept as a
// string here so react-hook-form has a clean input/output type; the empties
// are dropped (and `price` is parsed) before onSubmit hands them back.
const itemSchema = z.object({
  name: z.string().trim().min(1, 'Name your item').max(200, 'Keep it under 200 characters'),
  link: z.string(),
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
  priority: z.union([z.literal(''), z.literal('low'), z.literal('medium'), z.literal('high')]),
  price: z
    .string()
    .trim()
    .refine(value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), 'Enter a valid price'),
});

type ItemFormValues = z.infer<typeof itemSchema>;

// The shape create/update mutations take, minus the ids they resolve themselves.
export interface ItemInput {
  name: string;
  link?: string;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  price?: number;
}

interface Props {
  // Prefill for edit mode; omit to start blank.
  defaults?: ItemInput;
  submitLabel: string;
  onSubmit: (values: ItemInput) => Promise<void>;
  onCancel: () => void;
}

export default function ItemForm({ defaults, submitLabel, onSubmit, onCancel }: Props) {
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      link: defaults?.link ?? '',
      notes: defaults?.notes ?? '',
      priority: defaults?.priority ?? '',
      price: defaults?.price != null ? String(defaults.price) : '',
    },
  });

  async function handleSubmit(values: ItemFormValues) {
    await onSubmit({
      name: values.name,
      link: values.link.trim() || undefined,
      notes: values.notes || undefined,
      priority: values.priority || undefined,
      price: values.price ? Number(values.price) : undefined,
    });
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="my-4 flex flex-col gap-4">
        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-2/3">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem className="flex-1/3">
                <FormLabel>Priority</FormLabel>
                {/* Radix Select forbids an empty-string item value, so "none"
                    is the sentinel for the schema's unset ('') priority. */}
                <Select value={field.value || 'none'} onValueChange={value => field.onChange(value === 'none' ? '' : value)}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-row gap-2">
          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem className="flex-2/3">
                <FormLabel>Link</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem className="flex-1/3">
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Input placeholder="Size, colour, anything else" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              form.reset();
              onCancel();
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
