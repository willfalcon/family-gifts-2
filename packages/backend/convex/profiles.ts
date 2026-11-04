import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { authComponent, createAuth, searchFields } from './auth';
import { fullName, nameFields, nameParts } from './names';
import { birthdayValidator, birthdayVisibilityValidator, notificationPreferenceValidator } from './schema';
import { currencyValidator } from './currencies';
import { canViewProfile, visibleProfile } from './permissions';
import { hasListAccess } from './listShares';
import { withOccasionEvent } from './lists';
import { getClaimedItemCount } from './claims';

// The current user's profile row, or null if they have none yet.
export const getMine = query({
  args: {},
  handler: async ctx => {
    const user = await authComponent.getAuthUser(ctx);
    return await ctx.db
      .query('profiles')
      .withIndex('by_userId', q => q.eq('userId', user._id))
      .unique();
  },
});

// Another user's profile as seen by the current viewer. Returns null when the
// viewer isn't allowed to see this profile (or the user doesn't exist), so the
// route can render a not-found state. Name/image come from the Better Auth user
// record, not our `profiles` table. The visible profile fields are filtered
// through `visibleProfile` for privacy settings (currently a no-op).
export const getPublic = query({
  // `userId` comes from a URL param - untrusted, so take it as a plain string.
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    const viewerUserId = viewer?._id ?? null;

    if (!canViewProfile(ctx, viewerUserId, args.userId)) {
      return null;
    }

    const target = await authComponent.getAnyUserById(ctx, args.userId);
    if (!target) {
      return null;
    }

    const [profile, ownLists] = await Promise.all([
      ctx.db
        .query('profiles')
        .withIndex('by_userId', q => q.eq('userId', args.userId))
        .unique(),
      // Their non-archived lists; narrowed below to the ones the viewer can see.
      ctx.db
        .query('lists')
        .withIndex('by_createdBy_archivedAt', q => q.eq('createdBy', args.userId).eq('archivedAt', undefined))
        .collect(),
    ]);

    const isSelf = viewerUserId === args.userId;
    const access = await Promise.all(ownLists.map(list => viewerUserId !== null && hasListAccess(ctx, list, viewerUserId)));
    const lists = await Promise.all(
      ownLists
        .filter((_, i) => access[i])
        .map(async list => ({
          ...(await withOccasionEvent(ctx, list)),
          // How many items nobody has fully claimed yet. Null when viewing your
          // own profile - owners never see anything derived from claims.
          openItemCount: isSelf ? null : Math.max(0, list.itemCount - (await getClaimedItemCount(ctx, list._id))),
        })),
    );

    return {
      userId: args.userId,
      name: target.name,
      image: target.image ?? null,
      isSelf,
      ...visibleProfile(profile, viewerUserId, isSelf),
      lists,
    };
  },
});

const MAX_NAME_LENGTH = 50;

// A person's first name, from their profile. `name` is their full name, used
// to guess it for accounts from before names were split.
export async function getFirstName(ctx: QueryCtx, userId: string, name: string) {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_userId', q => q.eq('userId', userId))
    .unique();
  return nameParts(profile, name).firstName;
}

// Changes the current user's name. The parts are saved on their profile and
// the Better Auth user's `name` is set to the two joined, which is what every
// screen showing a full name reads. A last name is optional.
export const updateName = mutation({
  args: { firstName: v.string(), lastName: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const fields = nameFields(args.firstName, args.lastName);
    if (!fields.firstName) throw new ConvexError('Add your first name');
    if (fields.firstName.length > MAX_NAME_LENGTH || (fields.lastName?.length ?? 0) > MAX_NAME_LENGTH) {
      throw new ConvexError(`Keep each name under ${MAX_NAME_LENGTH} characters`);
    }

    // The profile goes first, so the user.onUpdate trigger in convex/auth.ts
    // sees parts that match the new name and leaves them alone.
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_userId', q => q.eq('userId', user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert('profiles', { userId: user._id, ...searchFields(user), ...fields });
    }

    const name = fullName(fields.firstName, fields.lastName);
    if (name !== user.name) {
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
      await auth.api.updateUser({ body: { name }, headers });
    }
  },
});

// Saves the name parts a sign-up form sent. Called by the Better Auth hook in
// convex/auth.ts right after the account is created. They come straight from
// the request, so they're only kept when they add up to the account's name.
export const setSignUpNameParts = internalMutation({
  args: { userId: v.string(), firstName: v.string(), lastName: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAnyUserById(ctx, args.userId);
    const fields = nameFields(args.firstName, args.lastName);
    if (!user || !fields.firstName || fullName(fields.firstName, fields.lastName) !== user.name) return;
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, fields);
  },
});

// Updates the current user's own profile row. Identity is derived server-side,
// so a caller can only ever write their own profile. The name is changed with
// `updateName` instead.
//
// Only the fields passed in are changed, so the client can save one field at a
// time. An empty/whitespace-only string clears that field, and `birthday: null`
// clears the birthday.
export const updateMine = mutation({
  args: {
    birthday: v.optional(v.union(birthdayValidator, v.null())),
    birthdayVisibility: v.optional(birthdayVisibilityValidator),
    birthdayGroupIds: v.optional(v.array(v.id('groups'))),
    notificationPreference: v.optional(notificationPreferenceValidator),
    shareNewLists: v.optional(v.array(v.id('groups'))),
    currency: v.optional(currencyValidator),
    shirtSize: v.optional(v.string()),
    notes: v.optional(v.string()),
    discoverable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);

    if (args.birthday) {
      const { month, day, year } = args.birthday;
      // Leap year 2000 so Feb 29 is allowed when no year is given.
      const check = new Date(year ?? 2000, month - 1, day);
      if (check.getMonth() !== month - 1 || check.getDate() !== day) {
        throw new Error('Invalid birthday');
      }
    }

    // Only the user's own groups can be picked to see their birthday or get
    // their new lists.
    for (const groupId of [...(args.birthdayGroupIds ?? []), ...(args.shareNewLists ?? [])]) {
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', q => q.eq('groupId', groupId).eq('userId', user._id))
        .unique();
      if (!membership) throw new Error('Not a member of that group');
    }

    // A key left out of `args` is left out of the patch, so it stays as it is.
    // A key set to `undefined` in a patch deletes that field, which is how
    // blank strings and `birthday: null` clear things.
    // `birthdayGroupIds` is kept even when visibility isn't 'someGroups', so
    // switching back restores the user's picks. Readers should only use it
    // when visibility is 'someGroups'.
    const fields: Partial<Omit<Doc<'profiles'>, '_id' | '_creationTime' | 'userId'>> = {};
    if ('birthday' in args) fields.birthday = args.birthday ?? undefined;
    if ('birthdayVisibility' in args) fields.birthdayVisibility = args.birthdayVisibility;
    if ('birthdayGroupIds' in args) fields.birthdayGroupIds = args.birthdayGroupIds;
    if ('notificationPreference' in args) fields.notificationPreference = args.notificationPreference;
    if ('shareNewLists' in args) fields.shareNewLists = args.shareNewLists;
    if ('currency' in args) fields.currency = args.currency;
    if ('shirtSize' in args) fields.shirtSize = args.shirtSize?.trim() || undefined;
    if ('notes' in args) fields.notes = args.notes?.trim() || undefined;
    if ('discoverable' in args) fields.discoverable = args.discoverable;

    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_userId', q => q.eq('userId', user._id))
      .unique();
    // Upsert: also covers any user created before the onCreate trigger existed.
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert('profiles', { userId: user._id, ...searchFields(user), ...fields });
    }
  },
});
