import { defineSchema, defineTable } from 'convex/server';
import { v, type Infer } from 'convex/values';

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

  groups: defineTable({
    name: v.string(),
    // Better Auth user id of whoever created the group.
    createdBy: v.string(),
  }).index('by_createdBy', ['createdBy']),

  // users <-> groups (many-to-many). One row per (group, user).
  groupMembers: defineTable({
    groupId: v.id('groups'),
    userId: v.string(), // Better Auth user id
    role: v.union(v.literal('owner'), v.literal('member')),
  })
    .index('by_group', ['groupId']) // members of a group
    .index('by_user', ['userId']) // groups a user is in
    .index('by_group_user', ['groupId', 'userId']), // membership check / uniqueness

  // lists <-> (a user OR a group). Exactly one of sharedWith* is set per row.
  listShares: defineTable({
    listId: v.id('lists'),
    sharedWithUserId: v.optional(v.string()),
    sharedWithGroupId: v.optional(v.id('groups')),
    canEdit: v.boolean(),
  })
    .index('by_list', ['listId'])
    .index('by_group', ['sharedWithGroupId'])
    .index('by_user', ['sharedWithUserId']),
});
