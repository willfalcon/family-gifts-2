import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Standard adult sizes. Stored as a plain string in the `profiles` table, so
// this list can grow without a schema change.
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;

// Every field is kept as a string so react-hook-form has a clean value type.
// Blank strings mean "not set" - the mutation clears those fields, and the
// name update is skipped when it hasn't changed.
const profileSchema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(100, 'Keep it under 100 characters'),
  birthday: z.string(),
  shirtSize: z.string(),
  bio: z.string().trim().max(1000, 'Keep your bio under 1000 characters'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export interface ProfileDefaults {
  name: string;
  birthday?: string;
  shirtSize?: string;
  notes?: string;
}

interface Props {
  defaults: ProfileDefaults;
}

export function ProfileForm({ defaults }: Props) {
  const updateProfile = useMutation({ mutationFn: useConvexMutation(api.profiles.updateMine) });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: defaults.name ?? '',
      birthday: defaults.birthday ?? '',
      shirtSize: defaults.shirtSize ?? '',
      bio: defaults.notes ?? '',
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    const name = values.name.trim();

    // Name lives on the Better Auth user record (the whole app reads it from
    // there), so it updates through the auth client, not our mutation.
    if (name !== defaults.name) {
      const res = await authClient.updateUser({ name });
      if (res.error) {
        form.setError('name', { message: res.error.message ?? 'Could not save your name' });
        return;
      }
    }

    await updateProfile.mutateAsync({
      birthday: values.birthday,
      shirtSize: values.shirtSize,
      notes: values.bio,
    });

    // Re-baseline the form so it's no longer "dirty" against the saved values.
    form.reset({ ...values, name });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="my-4 flex max-w-md flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="birthday"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Birthday</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shirtSize"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Shirt size</FormLabel>
                {/* Radix Select forbids an empty-string item value, so "none"
                    is the sentinel for the unset size. */}
                <Select
                  value={field.value || 'none'}
                  onValueChange={value => field.onChange(value === 'none' ? '' : value)}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No size</SelectItem>
                    {SHIRT_SIZES.map(size => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea placeholder="Anything you'd want family to know" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}
