import { v } from 'convex/values';
import { internalMutation, type QueryCtx } from './_generated/server';
import { AVATAR_COLORS, type AvatarColor } from './avatarColors';
import { authComponent, searchFields } from './auth';

const SEARCH_LIMIT = 20;
const MIN_SEARCH_LENGTH = 2;

// Whether this user has chosen to show up in searches by people they aren't
// connected to.
export async function isDiscoverable(ctx: QueryCtx, userId: string) {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_userId', q => q.eq('userId', userId))
    .unique();
  return profile?.discoverable === true;
}

// A stable avatar color for someone with no group or event row to take one
// from, so it doesn't change between renders.
function colorFor(userId: string): AvatarColor {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length].hex;
}

// Discoverable people matching `search` by name or email, other than the
// viewer and anyone `skip` returns true for. A full email always finds its
// discoverable owner, even when the text search would rank them out.
export async function searchDiscoverable(
  ctx: QueryCtx,
  viewerId: string,
  search: string,
  skip: (userId: string, email: string) => boolean,
) {
  const text = search.trim().toLowerCase();
  if (text.length < MIN_SEARCH_LENGTH) return [];

  const exact = text.includes('@')
    ? await ctx.db
        .query('profiles')
        .withIndex('by_email', q => q.eq('email', text))
        .first()
    : null;
  const matches = await ctx.db
    .query('profiles')
    .withSearchIndex('search_searchText', q => q.search('searchText', text).eq('discoverable', true))
    .take(SEARCH_LIMIT);

  const seen = new Set<string>();
  const people = await Promise.all(
    [...(exact?.discoverable ? [exact] : []), ...matches].map(async profile => {
      if (profile.userId === viewerId || seen.has(profile.userId)) return null;
      seen.add(profile.userId);
      const person = await authComponent.getAnyUserById(ctx, profile.userId);
      if (!person || skip(profile.userId, person.email.toLowerCase())) return null;
      return {
        userId: profile.userId,
        name: person.name,
        image: person.image ?? null,
        color: colorFor(profile.userId),
        sharedGroups: 0,
        sharedEvents: 0,
      };
    }),
  );
  return people.filter(person => person !== null);
}

// One-off: fills in the search fields for accounts made before they existed,
// and makes those accounts discoverable. New accounts start hidden instead.
//
//   npx convex run people:backfillSearch
export const backfillSearch = internalMutation({
  args: {},
  returns: v.number(),
  handler: async ctx => {
    let updated = 0;
    for await (const profile of ctx.db.query('profiles')) {
      const user = await authComponent.getAnyUserById(ctx, profile.userId);
      if (!user) continue;
      await ctx.db.patch(profile._id, {
        ...searchFields(user),
        discoverable: profile.discoverable ?? true,
      });
      updated++;
    }
    return updated;
  },
});
