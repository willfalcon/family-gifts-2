import { z } from 'zod';
// Relative (not @convex/*) so the Convex bundler can resolve it too; type-only, so nothing is bundled.
import type { Id } from '../../backend/convex/_generated/dataModel';

// What a list is for. Mirrors `lists.occasion` in convex/schema.ts.
// Leaving it out means "Just ideas" (no event or date).
export const occasionSchema = z.discriminatedUnion('kind', [
  // "Christmas party": a real event the user is attending.
  z.object({
    kind: z.literal('event'),
    eventId: z.custom<Id<'events'>>(v => typeof v === 'string' && v.length > 0, 'Pick an event'),
  }),
  z.object({ kind: z.literal('christmas') }),
  // "My birthday": always the list creator's birthday.
  z.object({ kind: z.literal('birthday') }),
  // "Another occasion": just a date, no event row.
  z.object({ kind: z.literal('date'), date: z.iso.date('Pick a date') }),
]);

export type OccasionInput = z.infer<typeof occasionSchema>;

// Validation for a list's editable fields. Used by the web and mobile forms
// and by the lists.create / lists.update mutations, so all three agree.
export const listSchema = z.object({
  title: z.string().trim().min(1, 'Give your list a name').max(100, 'Keep it under 100 characters'),
  occasion: occasionSchema.optional(),
  // Groups that can see the list. Saved as listShares rows, not on the list itself.
  // Optional so a form that doesn't show visibility (web, for now) leaves shares alone.
  sharedWithGroupIds: z.array(z.custom<Id<'groups'>>(v => typeof v === 'string' && v.length > 0)).optional(),
});

export type ListInput = z.infer<typeof listSchema>;
