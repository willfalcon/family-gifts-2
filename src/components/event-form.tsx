import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import EventDateRangeField from '@/components/event-date-range-field';
import EventTimeField from '@/components/event-time-field';

const eventSchema = z.object({
  name: z.string().trim().min(1, 'Give your event a name').max(100, 'Keep it under 100 characters'),
  description: z.string().trim().max(2000, 'Keep it under 2000 characters').optional(),
  date: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export interface EventInput {
  name: string;
  description?: string;
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

interface Props {
  defaults?: EventInput;
  submitLabel: string;
  onSubmit: (values: EventInput) => Promise<void>;
  onCancel: () => void;
}

export default function EventForm({ defaults, submitLabel, onSubmit, onCancel }: Props) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      description: defaults?.description ?? '',
      date: defaults?.date ?? '',
      endDate: defaults?.endDate ?? '',
      startTime: defaults?.startTime ?? '',
      endTime: defaults?.endTime ?? '',
    },
  });

  async function handleSubmit(values: EventFormValues) {
    await onSubmit({
      name: values.name,
      description: values.description || undefined,
      date: values.date || undefined,
      endDate: values.endDate || undefined,
      startTime: values.startTime || undefined,
      endTime: values.endTime || undefined,
    });
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6 items-start">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Input placeholder="Event name" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Textarea placeholder="Description (optional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => {
            // useWatch (a real hook, unlike ad-hoc form.watch()) keeps this in
            // sync whenever `endDate` changes elsewhere in the form.
            const endDate = useWatch({ control: form.control, name: 'endDate' });
            return (
              <FormItem className="w-full">
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <EventDateRangeField
                    from={field.value}
                    to={endDate}
                    onChange={(from, to) => {
                      field.onChange(from ?? '');
                      form.setValue('endDate', to ?? '');
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <div className="flex w-full gap-3">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Start time</FormLabel>
                <FormControl>
                  <EventTimeField ariaLabel="Start time" value={field.value} onChange={value => field.onChange(value ?? '')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>End time</FormLabel>
                <FormControl>
                  <EventTimeField ariaLabel="End time" value={field.value} onChange={value => field.onChange(value ?? '')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" type="submit" disabled={form.formState.isSubmitting}>
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
