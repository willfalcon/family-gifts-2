import { z } from 'zod';

// Validation for a list's editable fields. Used by the web and mobile forms
// and by the lists.create / lists.update mutations, so all three agree.
export const listSchema = z.object({
  title: z.string().trim().min(1, 'Give your list a name').max(100, 'Keep it under 100 characters'),
});

export type ListInput = z.infer<typeof listSchema>;
