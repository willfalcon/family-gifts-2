import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const createListSchema = z.object({
  title: z.string().trim().min(1, 'Give your list a name').max(100, 'Keep it under 100 characters'),
});

type CreateListValues = z.infer<typeof createListSchema>;

export function CreateListForm() {
  const [open, setOpen] = useState(false);
  const createList = useMutation({ mutationFn: useConvexMutation(api.lists.create) });
  const form = useForm<CreateListValues>({
    resolver: zodResolver(createListSchema),
    defaultValues: { title: '' },
  });

  async function onSubmit(values: CreateListValues) {
    await createList.mutateAsync(values);
    form.reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="link" className="text-accent hover:no-underline cursor-pointer pl-0" onClick={() => setOpen(true)}>
        <Plus />
        New List
      </Button>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input placeholder="List name" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant="default" type="submit" disabled={form.formState.isSubmitting}>
          Create
        </Button>
        <Button
          variant="link"
          onClick={() => {
            setOpen(false);
            form.reset();
          }}
        >
          Cancel
        </Button>
      </form>
    </Form>
  );
}
