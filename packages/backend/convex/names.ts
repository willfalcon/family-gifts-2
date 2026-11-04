// Helpers for people's names. Pure functions only, so the apps can import
// them too.
//
// A person's first and last name are stored on their `profiles` row. The
// Better Auth user's `name` is always the two joined (see `fullName`), and
// it's what every screen showing a full name reads.

export function fullName(firstName: string, lastName?: string | null) {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(' ');
}

// The name parts as stored on a profile: trimmed, with a blank last name
// left out.
export function nameFields(firstName: string, lastName?: string | null) {
  return { firstName: firstName.trim(), lastName: lastName?.trim() || undefined };
}

// Best guess at the parts of a full name: the last word is the last name,
// everything before it the first name ("Leigh Ann Hawks" -> "Leigh Ann" +
// "Hawks"). Only used when the real parts aren't known, e.g. for accounts
// from before names were split.
export function splitName(name: string): { firstName: string; lastName: string } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { firstName: words[0] ?? '', lastName: '' };
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] };
}

// A person's name parts: the saved ones when their profile has them,
// otherwise a guess from their full name.
export function nameParts(
  profile: { firstName?: string; lastName?: string } | null | undefined,
  name: string,
): { firstName: string; lastName: string } {
  if (profile?.firstName) return { firstName: profile.firstName, lastName: profile.lastName ?? '' };
  return splitName(name);
}
