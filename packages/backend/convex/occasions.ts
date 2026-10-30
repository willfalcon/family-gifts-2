import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import type { Birthday } from './schema';

// Only occasions this many days out (or fewer) count as "coming up".
export const UPCOMING_WINDOW_DAYS = 60;

export type UpcomingOccasion = { label: string; date: string; kind: 'birthday' | 'event' | 'christmas' | 'date' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The client passes its own local "today" so the answer matches the viewer's
// calendar (the server runs in UTC). Falls back to UTC if it's malformed.
export function normalizeToday(today: string) {
  return ISO_DATE.test(today) ? today : new Date().toISOString().slice(0, 10);
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// The next time a yearly month/day falls on or after `today`. Feb 29 lands
// on Feb 28 in non-leap years.
function nextYearly(month: number, day: number, today: string) {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const d = month === 2 && day === 29 && !isLeapYear(y) ? 28 : day;
    const date = toISO(y, month, d);
    if (date >= today) return date;
  }
  return toISO(year + 1, month, day);
}

// Whether `profile`'s birthday may be shown to members of `groupId`.
export function birthdayVisibleInGroup(profile: Doc<'profiles'> | null, groupId: string): Birthday | null {
  if (!profile?.birthday) return null;
  const visibility = profile.birthdayVisibility ?? 'private';
  if (visibility === 'allGroups') return profile.birthday;
  if (visibility === 'someGroups' && profile.birthdayGroupIds?.some(id => id === groupId)) return profile.birthday;
  return null;
}

// The soonest occasion within the window, from a person's (visible) birthday
// and the occasions of their lists. Null when nothing is coming up.
export async function nextOccasion(
  ctx: QueryCtx,
  { birthday, lists, today }: { birthday: Birthday | null; lists: Doc<'lists'>[]; today: string },
): Promise<UpcomingOccasion | null> {
  const candidates: UpcomingOccasion[] = [];

  if (birthday) {
    candidates.push({ kind: 'birthday', label: 'Birthday', date: nextYearly(birthday.month, birthday.day, today) });
  }

  for (const list of lists) {
    const occasion = list.occasion;
    if (!occasion) continue;
    if (occasion.kind === 'christmas') {
      candidates.push({ kind: 'christmas', label: 'Christmas', date: nextYearly(12, 25, today) });
    } else if (occasion.kind === 'date') {
      if (ISO_DATE.test(occasion.date) && occasion.date >= today) {
        candidates.push({ kind: 'date', label: list.title, date: occasion.date });
      }
    } else if (occasion.kind === 'event') {
      const event = await ctx.db.get(occasion.eventId);
      // A multi-day event that's already started still counts until it ends.
      if (event?.date && (event.endDate ?? event.date) >= today) {
        candidates.push({ kind: 'event', label: event.name, date: event.date < today ? today : event.date });
      }
    }
    // 'birthday' lists are covered by the birthday above, and only shown when
    // the person lets this group see their birthday.
  }

  const soonest = candidates
    .filter(c => daysBetween(today, c.date) <= UPCOMING_WINDOW_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return soonest ?? null;
}
