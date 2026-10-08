import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { bigTitleClasses } from '@/components/ui/big-title';

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Give your group a name').max(100, 'Keep it under 100 characters'),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export interface GroupInput {
  name: string;
}

interface Props {
  update?: boolean;
  defaults?: GroupInput;
  submitLabel: string;
  onSubmit: (values: GroupInput) => Promise<void>;
  onCancel: () => void;
}

export default function GroupForm({ update = false, defaults, submitLabel, onSubmit, onCancel }: Props) {
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: defaults?.name ?? '' },
  });

  async function handleSubmit(values: GroupFormValues) {
    await onSubmit(values);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={cn('flex gap-2', update ? 'items-stretch' : 'items-start')}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                {update ? (
                  <input
                    placeholder="Group name"
                    autoFocus
                    className={cn(
                      bigTitleClasses,
                      'w-full border-b border-input bg-transparent outline-none placeholder:text-slate placeholder:font-body placeholder:font-normal placeholder:text-[15px] placeholder:tracking-normal'
                    )}
                    {...field}
                  />
                ) : (
                  <Input placeholder="Group name" autoFocus {...field} />
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
