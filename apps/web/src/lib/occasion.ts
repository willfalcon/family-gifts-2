import type { Doc } from '@convex/_generated/dataModel';

export function formatOccasionDate(isoDate: string) {
  // Parse as local date to avoid UTC-offset surprises on "YYYY-MM-DD" strings.
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ListOccasion {
  occasion?: Doc<'lists'>['occasion'];
  occasionEventName?: string | null;
  occasionEventDate?: string | null;
}

// A list's occasion as summary parts, e.g. ["Christmas party", "Dec 15"].
// `birthdayLabel` varies by viewer ("My birthday", "Sam's birthday").
export function occasionParts(list: ListOccasion, birthdayLabel = 'Birthday'): string[] {
  const { occasion } = list;
  switch (occasion?.kind) {
    case 'event':
      return [
        list.occasionEventName ?? 'Event',
        ...(list.occasionEventDate ? [formatOccasionDate(list.occasionEventDate)] : []),
      ];
    case 'christmas':
      return ['Christmas'];
    case 'birthday':
      return [birthdayLabel];
    case 'date':
      return [formatOccasionDate(occasion.date)];
    default:
      return [];
  }
}
