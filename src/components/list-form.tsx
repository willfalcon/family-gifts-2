import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { bigTitleClasses } from '@/components/ui/big-title';

const listSchema = z.object({
  title: z.string().trim().min(1, 'Give your list a name').max(100, 'Keep it under 100 characters'),
});

type ListFormValues = z.infer<typeof listSchema>;

// The shape create/update mutations take, minus the id update resolves itself.
export interface ListInput {
  title: string;
}

interface Props {
  // True for editing an existing list, so the title field can read as an
  // in-place edit of the page's own heading rather than a plain form input.
  update?: boolean;
  // Prefill for edit mode; omit to start blank.
  defaults?: ListInput;
  submitLabel: string;
  onSubmit: (values: ListInput) => Promise<void>;
  onCancel: () => void;
}

export default function ListForm({ update = false, defaults, submitLabel, onSubmit, onCancel }: Props) {
  const form = useForm<ListFormValues>({
    resolver: zodResolver(listSchema),
    defaultValues: { title: defaults?.title ?? '' },
  });

  async function handleSubmit(values: ListFormValues) {
    await onSubmit(values);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={cn('flex gap-2', update ? 'items-stretch' : 'items-start')}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                {update ? (
                  // Edit mode reads as an in-place edit of the page's own title, so it
                  // borrows BigTitle's exact type styles rather than the standard Input look.
                  <input
                    placeholder="List name"
                    autoFocus
                    className={cn(
                      bigTitleClasses,
                      'w-full border-b border-input bg-transparent outline-none placeholder:text-slate placeholder:font-body placeholder:font-normal placeholder:text-[15px] placeholder:tracking-normal'
                    )}
                    {...field}
                  />
                ) : (
                  <Input placeholder="List name" autoFocus {...field} />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
