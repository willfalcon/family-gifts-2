import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { birthdayValidator, birthdayVisibilityValidator } from "./schema";
import { canViewProfile, visibleProfile } from "./permissions";

// The current user's profile row, or null if they have none yet.
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
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

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const isSelf = viewerUserId === args.userId;
    return {
      userId: args.userId,
      name: target.name,
      image: target.image ?? null,
      isSelf,
      ...visibleProfile(profile, viewerUserId, isSelf),
    };
  },
});

// Updates the current user's own profile row. Identity is derived server-side,
// so a caller can only ever write their own profile. The display name lives on
// the Better Auth user record and is updated separately by the client.
//
// Every field is optional; an empty/whitespace-only string clears that field,
// and `birthday: null` clears the birthday.
export const updateMine = mutation({
  args: {
    birthday: v.optional(v.union(birthdayValidator, v.null())),
    birthdayVisibility: v.optional(birthdayVisibilityValidator),
    birthdayGroupIds: v.optional(v.array(v.id("groups"))),
    shirtSize: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);

    if (args.birthday) {
      const { month, day, year } = args.birthday;
      // Leap year 2000 so Feb 29 is allowed when no year is given.
      const check = new Date(year ?? 2000, month - 1, day);
      if (check.getMonth() !== month - 1 || check.getDate() !== day) {
        throw new Error("Invalid birthday");
      }
    }

    // Setting a field to `undefined` in a patch deletes it, so blank inputs
    // don't linger as empty strings.
    const fields = {
      birthday: args.birthday ?? undefined,
      birthdayVisibility: args.birthdayVisibility,
      // Only meaningful for 'someGroups'; drop it otherwise.
      birthdayGroupIds:
        args.birthdayVisibility === "someGroups" ? args.birthdayGroupIds : undefined,
      shirtSize: args.shirtSize?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
    };

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    // Upsert: also covers any user created before the onCreate trigger existed.
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("profiles", { userId: user._id, ...fields });
    }
  },
});
