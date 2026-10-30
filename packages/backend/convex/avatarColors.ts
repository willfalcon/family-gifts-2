import { v, type Infer } from 'convex/values';

// Fixed palette for member avatar placeholders. Matches the `avatar-*` colors
// in packages/design-tokens/index.js - change both together. Stored values are
// checked against this list, so changing a hex here also means rewriting the
// rows that already use the old one.
export const AVATAR_COLORS = [
  { name: 'Navy', hex: '#1B2340' },
  { name: 'Terracotta', hex: '#A0553A' },
  { name: 'Forest', hex: '#35614A' },
  { name: 'Teal', hex: '#24706E' },
  { name: 'Plum', hex: '#5B3A5E' },
  { name: 'Slate Blue', hex: '#48577A' },
  { name: 'Ochre', hex: '#8A6822' },
  { name: 'Berry', hex: '#7A3350' },
] as const;

export const avatarColorValidator = v.union(...AVATAR_COLORS.map(c => v.literal(c.hex)));
export type AvatarColor = Infer<typeof avatarColorValidator>;

// Picks a color for a new member, preferring one not already used by
// `usedColors` (their group's existing members) so a small group reads as
// visually distinct at a glance. Once every color in the palette is taken,
// falls back to a uniform random pick across the whole palette.
export function pickAvatarColor(usedColors: readonly string[]): AvatarColor {
  const used = new Set(usedColors);
  const available = AVATAR_COLORS.filter(c => !used.has(c.hex));
  const pool = available.length > 0 ? available : AVATAR_COLORS;
  return pool[Math.floor(Math.random() * pool.length)].hex;
}
