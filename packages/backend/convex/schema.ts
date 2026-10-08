import { defineSchema, defineTable } from 'convex/server';
import { v, type Infer } from 'convex/values';
import { avatarColorValidator } from './avatarColors';

// Reusable "enum". Import this in mutation args too, so the schema and the
// functions can never drift apart.
export const priorityValidator = v.union(v.literal('low'), v.literal('medium'), v.literal('high'));
export type Priority = Infer<typeof priorityValidator>; // "low" | "medium" | "high"

// App tables. Better Auth's own tables (user, session, account, ...) live in the
// betterAuth component and are not declared here.
export default defineSchema({
  // App-specific user data. One row per Better Auth user, keyed by their user id.
  // Created automatically by the `user.onCreate` trigger in convex/auth.ts.
  profiles: defineTable({
    userId: v.string(), // Better Auth user id
    birthday: v.optional(v.string()), // ISO date, "YYYY-MM-DD"
    shirtSize: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index('by_userId', ['userId']),
  lists: defineTable({
    title: v.string(),
    notes: v.optional(v.string()),
    // Denormalized count of `items` rows for this list, kept in sync by
    // convex/items.ts mutations. Avoids reading every item just to count them.
    itemCount: v.number(),
    // Better Auth user id of whoever added it.
    createdBy: v.string(),
  }).index('by_createdBy', ['createdBy']),

  items: defineTable({
    listId: v.id('lists'),
    name: v.string(),
    link: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    price: v.optional(v.number()),
    // Better Auth user id of whoever added it.
    createdBy: v.string(),
  }).index('by_listId', ['listId']),

  events: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    date: v.optional(v.string()), // ISO date, "YYYY-MM-DD" - start date
    endDate: v.optional(v.string()), // ISO date - only set when it differs from `date`
    startTime: v.optional(v.string()), // "HH:MM", 24h
    endTime: v.optional(v.string()),
    // Better Auth user id of whoever created it.
    createdBy: v.string(),
  }).index('by_createdBy', ['createdBy']),

  // users <-> events (many-to-many). Mirrors groupMembers - events are
  // independent of groups, with their own owner/manager/guest roster, so a
  // group can be invited to an event without the two becoming structurally linked.
  eventAttendees: defineTable({
    eventId: v.id('events'),
    userId: v.string(), // Better Auth user id
    role: v.union(v.literal('owner'), v.literal('manager'), v.literal('guest')),
    color: avatarColorValidator,
  })
    .index('by_event', ['eventId'])
    .index('by_user', ['userId'])
    .index('by_event_user', ['eventId', 'userId']),

  // A pending (or resolved) email invite to attend an event. Mirrors
  // groupInvites. `sourceGroupId` is set when this invite was created as part
  // of inviting a whole group (see events.inviteGroup) - purely for display
  // ("invited via the Smith Family group"), not a live link to the group.
  eventInvites: defineTable({
    eventId: v.id('events'),
    email: v.string(), // lowercased
    token: v.string(),
    invitedBy: v.string(), // Better Auth user id
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('revoked')),
    sourceGroupId: v.optional(v.id('groups')),
  })
    .index('by_token', ['token'])
    .index('by_event', ['eventId'])
    .index('by_event_email', ['eventId', 'email']),

  groups: defineTable({
    name: v.string(),
    // Better Auth user id of whoever created the group.
    createdBy: v.string(),
  }).index('by_createdBy', ['createdBy']),

  // users <-> groups (many-to-many). One row per (group, user).
  groupMembers: defineTable({
    groupId: v.id('groups'),
    userId: v.string(), // Better Auth user id
    // Exactly one 'owner' per group at a time; 'owner' carries every 'manager'
    // permission plus the ability to delete the group or transfer ownership.
    role: v.union(v.literal('owner'), v.literal('manager'), v.literal('member')),
    // Avatar placeholder color, assigned once when the member joins. See
    // convex/avatarColors.ts for the palette and assignment logic.
    color: avatarColorValidator,
  })
    .index('by_group', ['groupId']) // members of a group
    .index('by_user', ['userId']) // groups a user is in
    .index('by_group_user', ['groupId', 'userId']), // membership check / uniqueness

  // A pending (or resolved) email invite to join a group. `token` is the
  // unguessable id embedded in the invite link - looking a row up by it is
  // the only way in, so no separate auth is needed to preview an invite.
  groupInvites: defineTable({
    groupId: v.id('groups'),
    email: v.string(), // lowercased
    token: v.string(),
    invitedBy: v.string(), // Better Auth user id
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('revoked')),
  })
    .index('by_token', ['token'])
    .index('by_group', ['groupId'])
    .index('by_group_email', ['groupId', 'email']),

  // One Secret Santa round per event. `status` moves 'draft' -> 'sent' once
  // and never back - a manager who wants to redo it calls secretSanta.reset,
  // which deletes this row (and everything below) so a fresh one can be made.
  secretSantas: defineTable({
    eventId: v.id('events'),
    status: v.union(v.literal('draft'), v.literal('sent')),
    createdBy: v.string(), // Better Auth user id
    sentAt: v.optional(v.number()),
  }).index('by_event', ['eventId']),

  // Attendees opted into a given Secret Santa round. Rewritten wholesale by
  // secretSanta.generate on every (re)generation, rather than diffed.
  secretSantaParticipants: defineTable({
    secretSantaId: v.id('secretSantas'),
    userId: v.string(), // Better Auth user id
  })
    .index('by_secretSanta', ['secretSantaId'])
    .index('by_secretSanta_user', ['secretSantaId', 'userId']),

  // A one-directional "userId must not be assigned to give to excludedUserId"
  // constraint. The UI adds these in mutual pairs (couples excluding each
  // other), but the row itself only encodes one direction.
  secretSantaExclusions: defineTable({
    secretSantaId: v.id('secretSantas'),
    userId: v.string(),
    excludedUserId: v.string(),
  }).index('by_secretSanta', ['secretSantaId']),

  // The generated (or since-edited) matchups. `by_secretSanta_giver` backs
  // both the manager's full-roster view and a member's own-assignment lookup.
  secretSantaAssignments: defineTable({
    secretSantaId: v.id('secretSantas'),
    giverUserId: v.string(),
    receiverUserId: v.string(),
  })
    .index('by_secretSanta', ['secretSantaId'])
    .index('by_secretSanta_giver', ['secretSantaId', 'giverUserId']),

  // lists <-> (a user OR a group OR an event). Exactly one of sharedWith* is
  // set per row. Sharing with a group/event is a live link to that group/event
  // as a whole - not fanned out into one row per current member/attendee - so
  // unsharing is a single delete here regardless of roster size, and someone
  // who joins later automatically gets access without a backfill.
  listShares: defineTable({
    listId: v.id('lists'),
    sharedWithUserId: v.optional(v.string()),
    sharedWithGroupId: v.optional(v.id('groups')),
    sharedWithEventId: v.optional(v.id('events')),
    canEdit: v.boolean(),
  })
    .index('by_list', ['listId'])
    .index('by_group', ['sharedWithGroupId'])
    .index('by_event', ['sharedWithEventId'])
    .index('by_user', ['sharedWithUserId']),

  // A user's favorite of a user, list, group, or event - exactly one of
  // favorited* is set per row. `by_user_favorited*Id` backs the toggle (does
  // this favorite already exist?); the bare `by_favorited*Id` indexes back
  // cascade-delete when the target itself is deleted.
  favorites: defineTable({
    userId: v.string(), // the favoriter - Better Auth user id
    favoritedUserId: v.optional(v.string()),
    favoritedListId: v.optional(v.id('lists')),
    favoritedGroupId: v.optional(v.id('groups')),
    favoritedEventId: v.optional(v.id('events')),
  })
    .index('by_user', ['userId'])
    .index('by_user_favoritedUserId', ['userId', 'favoritedUserId'])
    .index('by_user_favoritedListId', ['userId', 'favoritedListId'])
    .index('by_user_favoritedGroupId', ['userId', 'favoritedGroupId'])
    .index('by_user_favoritedEventId', ['userId', 'favoritedEventId'])
    .index('by_favoritedUserId', ['favoritedUserId'])
    .index('by_favoritedListId', ['favoritedListId'])
    .index('by_favoritedGroupId', ['favoritedGroupId'])
    .index('by_favoritedEventId', ['favoritedEventId']),
});
