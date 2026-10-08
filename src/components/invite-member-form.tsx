import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { UserPlus } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const inviteSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface Props {
  groupId: Id<'groups'>;
}

export default function InviteMemberForm({ groupId }: Props) {
  const [open, setOpen] = useState(false);
  const invite = useMutation({ mutationFn: useConvexMutation(api.groups.invite) });
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  });

  if (!open) {
    return (
      <Button variant="link" className="text-accent hover:no-underline cursor-pointer pl-0" onClick={() => setOpen(true)}>
        <UserPlus />
        Invite Someone
      </Button>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async values => {
          await invite.mutateAsync({ groupId, email: values.email });
          form.reset();
          setOpen(false);
        })}
        className="flex items-start gap-2"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input placeholder="Email address" type="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Send Invite
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              form.reset();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
