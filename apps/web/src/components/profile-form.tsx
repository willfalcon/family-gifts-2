import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@convex/_generated/api';
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
  firstName: z.string().trim().min(1, 'Add your first name').max(50, 'Keep it under 50 characters'),
  lastName: z.string().trim().max(50, 'Keep it under 50 characters'),
  birthday: z.string(),
  shirtSize: z.string(),
  bio: z.string().trim().max(1000, 'Keep your bio under 1000 characters'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export interface ProfileDefaults {
  firstName: string;
  lastName: string;
  birthday?: string;
  shirtSize?: string;
  notes?: string;
}

interface Props {
  defaults: ProfileDefaults;
}

export function ProfileForm({ defaults }: Props) {
  const updateProfile = useMutation({ mutationFn: useConvexMutation(api.profiles.updateMine) });
  const updateName = useMutation({ mutationFn: useConvexMutation(api.profiles.updateName) });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      birthday: defaults.birthday ?? '',
      shirtSize: defaults.shirtSize ?? '',
      bio: defaults.notes ?? '',
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();

    if (firstName !== defaults.firstName || lastName !== defaults.lastName) {
      try {
        await updateName.mutateAsync({ firstName, lastName });
      } catch {
        form.setError('firstName', { message: 'Could not save your name' });
        return;
      }
    }

    await updateProfile.mutateAsync({
      birthday: values.birthday,
      shirtSize: values.shirtSize,
      notes: values.bio,
    });

    // Re-baseline the form so it's no longer "dirty" against the saved values.
    form.reset({ ...values, firstName, lastName });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="my-4 flex max-w-md flex-col gap-4">
        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input autoFocus autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
