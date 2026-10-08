import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Profile visibility rules live here so every read of another user's profile
// routes through one place. Today the rules are permissive stubs; the real
// logic (blocked users, group-scoped visibility, private accounts, per-field
// privacy settings) gets filled in here later without touching call sites.

// The subset of profile fields a viewer is ever allowed to see. Keep this in
// sync with the `profiles` table shape in convex/schema.ts.
export type VisibleProfile = {
  birthday?: string;
  shirtSize?: string;
  notes?: string;
};

/**
 * Whether `viewerUserId` (a Better Auth user id, or `null` when signed out) is
 * allowed to load `targetUserId`'s profile page at all.
 *
 * Stub: any signed-in user may view any profile; signed-out users may view
 * none. Replace with the real access rules when they exist.
 */
export function canViewProfile(
  _ctx: QueryCtx,
  viewerUserId: string | null,
  _targetUserId: string,
): boolean {
  return viewerUserId !== null;
}

/**
 * Narrows a profile row to the fields the viewer is permitted to see, based on
 * the target user's privacy settings.
 *
 * Stub: returns every field. When per-field visibility settings land, drop the
 * hidden fields here (the caller already treats the result as the whole
 * viewable profile).
 */
export function visibleProfile(
  profile: Doc<"profiles"> | null,
  _viewerUserId: string | null,
  _isSelf: boolean,
): VisibleProfile {
  return {
    birthday: profile?.birthday,
    shirtSize: profile?.shirtSize,
    notes: profile?.notes,
  };
}
