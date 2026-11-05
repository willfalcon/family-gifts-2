import { defineSchema, defineTable } from 'convex/server';
import { v, type Infer } from 'convex/values';
import { avatarColorValidator } from './avatarColors';
import { currencyValidator } from './currencies';

// Reusable "enum". Import this in mutation args too, so the schema and the
// functions can never drift apart.
export const priorityValidator = v.union(v.literal('low'), v.literal('medium'), v.literal('high'));
export type Priority = Infer<typeof priorityValidator>; // "low" | "medium" | "high"

export const birthdayValidator = v.object({
  month: v.number(), // 1-12
  day: v.number(), // 1-31
  year: v.optional(v.number()), // set only when "Show my age" is on
});
export type Birthday = Infer<typeof birthdayValidator>;

export const birthdayVisibilityValidator = v.union(
  v.literal('allGroups'),
  v.literal('someGroups'),
  v.literal('private'),
);
export type BirthdayVisibility = Infer<typeof birthdayVisibilityValidator>;

// How far ahead to notify the user.
export const notificationPreferenceValidator = v.union(
  v.literal('none'),
  v.literal('day-before'),
  v.literal('week-before'),
  v.literal('3-weeks'),
);
export type NotificationPreference = Infer<typeof notificationPreferenceValidator>;
// Used when the user hasn't picked one. Anything that sends notifications
// should use this too, so it matches what the profile screen shows.
export const DEFAULT_NOTIFICATION_PREFERENCE: NotificationPreference = 'day-before';

// What a list is for. Mirrors `occasionSchema` in packages/shared/schemas/list.ts.
export const occasionValidator = v.union(
  v.object({ kind: v.literal('event'), eventId: v.id('events') }), // a real event, e.g. "Christmas party"
  v.object({ kind: v.literal('christmas') }), // Dec 25, every year
  v.object({ kind: v.literal('birthday') }), // "My birthday" (the creator's)
  v.object({ kind: v.literal('date'), date: v.string() }), // "Another occasion"
);

// What an Ask is for. A subset of the list occasions: another date isn't
// something you can ask about.
export const askOccasionValidator = v.union(
  v.object({ kind: v.literal('event'), eventId: v.id('events') }),
  v.object({ kind: v.literal('christmas') }),
  v.object({ kind: v.literal('birthday') }), // the asked person's
);
export type AskOccasion = Infer<typeof askOccasionValidator>;

// App tables. Better Auth's own tables (user, session, account, ...) live in the
// betterAuth component and are not declared here.
export default defineSchema({
  // App-specific user data. One row per Better Auth user, keyed by their user id.
  // Created automatically by the `user.onCreate` trigger in convex/auth.ts.
  profiles: defineTable({
    userId: v.string(), // Better Auth user id
    // The parts of the user's name. The Better Auth user's `name` is always
    // these two joined (see convex/names.ts). Missing on accounts from before
    // names were split - read them through `nameParts`, which falls back to
    // splitting the full name.
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    birthday: v.optional(birthdayValidator),
    birthdayVisibility: v.optional(birthdayVisibilityValidator),
    birthdayGroupIds: v.optional(v.array(v.id('groups'))), // only for 'someGroups'
    notificationPreference: v.optional(notificationPreferenceValidator), // none = DEFAULT_NOTIFICATION_PREFERENCE
    shareNewLists: v.optional(v.array(v.id('groups'))), // groups each new list is shared with
    currency: v.optional(currencyValidator), // none = DEFAULT_CURRENCY
    shirtSize: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Whether people who don't share a group or event with this user can find
    // them by name or email when inviting. Missing means hidden, and new
    // accounts start hidden (see the user.onCreate trigger in convex/auth.ts).
    discoverable: v.optional(v.boolean()),
    // Copies of the Better Auth user's email (lowercased) and "name email",
    // kept in sync by the user triggers in convex/auth.ts. Only used to find
    // people - never sent to anyone else.
    email: v.optional(v.string()),
    searchText: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_email', ['email'])
    .searchIndex('search_searchText', { searchField: 'searchText', filterFields: ['discoverable'] }),
  lists: defineTable({
    title: v.string(),
    notes: v.optional(v.string()),
    occasion: v.optional(occasionValidator), // none = "Just ideas"
    // Denormalized count of `items` rows for this list, kept in sync by
    // convex/items.ts mutations. Avoids reading every item just to count them.
    itemCount: v.number(),
    // Better Auth user id of whoever added it.
    createdBy: v.string(),
    // When the owner archived it. Archived lists drop out of the owner's main
    // lists and out of everyone else's view entirely, but keep their items and
    // shares so restoring brings everything back as it was.
    archivedAt: v.optional(v.number()),
  })
    .index('by_createdBy_archivedAt', ['createdBy', 'archivedAt'])
    .index('by_occasion_event', ['occasion.eventId']),

  items: defineTable({
    listId: v.id('lists'),
    name: v.string(),
    link: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    price: v.optional(v.number()),
    quantity: v.optional(v.number()),
    imageId: v.optional(v.id('_storage')),
    // Better Auth user id of whoever added it.
    createdBy: v.string(),
  }).index('by_listId', ['listId']),

  // One row per (item, person claiming it). `quantity` lets several people
  // split an item the owner wants more than one of. The list owner must never
  // see these - every read goes through convex/claims.ts, which hides them
  // from the owner.
  claims: defineTable({
    itemId: v.id('items'),
    listId: v.id('lists'), // denormalized from the item, for per-list cleanup
    userId: v.string(), // Better Auth user id of the claimer
    quantity: v.number(),
    // The claimer has marked that they've got it ("Bought"). Only the claimer
    // ever sees it - not the owner, not anyone else splitting the item.
    bought: v.optional(v.boolean()),
  })
    .index('by_item', ['itemId'])
    .index('by_item_user', ['itemId', 'userId'])
    .index('by_list', ['listId'])
    .index('by_user', ['userId']),

  // A gift idea someone jots down for another person. Only its author ever
  // sees it - every read and write goes through convex/privateIdeas.ts, which
  // scopes to the caller. `forUserId` is never shown anything about these.
  privateIdeas: defineTable({
    userId: v.string(), // Better Auth user id of the author
    forUserId: v.string(), // Better Auth user id of who the idea is for
    title: v.string(),
    description: v.optional(v.string()),
  }).index('by_user_forUser', ['userId', 'forUserId']),

  // How many items on a list are fully claimed (claims >= the item's quantity).
  // Kept in its own table, not on `lists`, so it can't leak to the owner
  // through any query that returns their list document. Maintained only by
  // `syncItemClaimed` in convex/claims.ts.
  listClaimStats: defineTable({
    listId: v.id('lists'),
    claimedItemCount: v.number(),
  }).index('by_list', ['listId']),

  events: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    date: v.optional(v.string()), // ISO date, "YYYY-MM-DD" - start date
    sourceBirthday: v.optional(
      v.object({
        userId: v.string(),
        year: v.number(),
      }),
    ),
    endDate: v.optional(v.string()), // ISO date - only set when it differs from `date`
    startTime: v.optional(v.string()), // "HH:MM", 24h
    endTime: v.optional(v.string()),
    location: v.optional(v.string()), // free text, e.g. "Grandma's house"
    // Better Auth user id of whoever created it.
    createdBy: v.string(),
    // Secret behind the event's shareable join link - anyone holding the link
    // can join, so it's never sent to clients except to people allowed to
    // share it (see events.getInviteLink). Hosts can reset it to cut off an
    // old link. Missing on events from before links; they get one the first
    // time a host resets the link.
    inviteToken: v.optional(v.string()),
    // Whether guests (not just hosts) may see and share the join link.
    // Missing means false.
    guestsCanInvite: v.optional(v.boolean()),
    // When a host cancelled the event. A cancelled event stays visible to its
    // attendees, but its invites and join link stop working until a host
    // restores it.
    cancelledAt: v.optional(v.number()),
    // A host said this event won't have a Secret Santa ("Secret Santa off"),
    // so hosts stop being asked to set one up. Missing means it's on.
    secretSantaOff: v.optional(v.boolean()),
  })
    .index('by_createdBy', ['createdBy'])
    .index('by_inviteToken', ['inviteToken']),

  // Everyone on an event's guest list, one row per person per event - from
  // the moment they're invited through to going or not. Events are
  // independent of groups, with their own owner/host/guest roster, so a group
  // can be invited to an event without the two becoming structurally linked.
  //
  // `userId` is set once the person has accepted or declined with their
  // account; until then the row is just an emailed invite (status 'invited')
  // known by `email` + `token`. Having a `userId` is what grants access to the
  // event (see events.getAttendance) - whether they're going or not.
  //
  // A host can revoke an unanswered invite: the row stays as a record (status
  // 'revoked', token cleared) and never has a `userId`, so it grants nothing.
  // Inviting the same email again brings it back to 'invited'.
  eventAttendees: defineTable({
    eventId: v.id('events'),
    userId: v.optional(v.string()), // Better Auth user id
    role: v.union(v.literal('owner'), v.literal('host'), v.literal('guest')),
    status: v.union(v.literal('invited'), v.literal('going'), v.literal('declined'), v.literal('revoked')),
    color: avatarColorValidator,
    email: v.optional(v.string()), // lowercased; set when invited by email
    token: v.optional(v.string()), // the invite link's secret; cleared once used
    invitedBy: v.optional(v.string()), // Better Auth user id
    // Set when invited as part of a whole group (events.inviteGroup) - purely
    // for display ("via the Smith Family"), not a live link to the group.
    sourceGroupId: v.optional(v.id('groups')),
    // When this attendee archived the event, tucking it into the Archived
    // section of their own events list. Personal - nobody else is affected.
    archivedAt: v.optional(v.number()),
  })
    .index('by_event', ['eventId'])
    .index('by_user', ['userId'])
    .index('by_event_user', ['eventId', 'userId'])
    .index('by_event_email', ['eventId', 'email'])
    .index('by_email_status', ['email', 'status'])
    .index('by_token', ['token']),

  groups: defineTable({
    name: v.string(),
    // Better Auth user id of whoever created the group.
    createdBy: v.string(),
    // Token for the group's shareable join link (/invite/<token>). Anyone
    // holding it can join, so it's never sent to clients that aren't allowed
    // to share it - see groups.getInviteLink. Managers can rotate it to cut
    // off an old link. Optional for groups created before links existed;
    // they get one the first time a manager resets the link.
    inviteToken: v.optional(v.string()),
    // Whether plain members (not just managers) may copy the join link.
    // Missing means false - only managers can.
    membersCanInvite: v.optional(v.boolean()),
  })
    .index('by_createdBy', ['createdBy'])
    .index('by_inviteToken', ['inviteToken']),

  // A record that a group was invited to an event (events.inviteGroup), so the
  // group page can list its events. One row per (event, group); re-inviting
  // the same group updates it. It's only a record of the invite - the members
  // still get individual invites, and the event's roster stays separate.
  eventGroupInvites: defineTable({
    eventId: v.id('events'),
    groupId: v.id('groups'),
    invitedBy: v.string(), // Better Auth user id of who last invited the group
    invitedAt: v.number(),
  })
    .index('by_group', ['groupId'])
    .index('by_event_group', ['eventId', 'groupId']),

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
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined'), v.literal('revoked')),
  })
    .index('by_token', ['token'])
    .index('by_group', ['groupId'])
    .index('by_group_email', ['groupId', 'email'])
    .index('by_email_status', ['email', 'status']),

  // One Secret Santa round per event. `status` moves 'draft' -> 'sent' when
  // names are drawn in a Secret draw. In a Reviewed draw it goes 'draft' ->
  // 'drawn' (hosts can see the Matches, nobody's been told) -> 'sent' once a
  // host sends the names. secretSanta.undoDraw moves it back to 'draft',
  // keeping who's in and the rules; secretSanta.reset deletes the round.
  secretSantas: defineTable({
    eventId: v.id('events'),
    status: v.union(v.literal('draft'), v.literal('drawn'), v.literal('sent')),
    createdBy: v.string(), // Better Auth user id
    // Missing means 'secret': nobody, hosts included, sees who drew whom.
    // 'reviewed': hosts see every Match, and nobody is told until a host
    // sends the names.
    mode: v.optional(v.union(v.literal('secret'), v.literal('reviewed'))),
    drawnAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    budget: v.optional(v.number()), // spending limit, in dollars
    // When names get drawn, as a timestamp. Missing means they were drawn
    // right at setup.
    drawAt: v.optional(v.number()),
    // Draw before `drawAt` as soon as everyone in the draw has replied.
    drawEarly: v.optional(v.boolean()),
    scheduledDrawId: v.optional(v.id('_scheduled_functions')),
    // Why a scheduled draw couldn't happen (e.g. fewer than 2 people going).
    drawError: v.optional(v.string()),
    // When a host last undid a draw whose names had been sent. Set while the
    // round waits to be drawn again; cleared once it's set up again.
    undoneAt: v.optional(v.number()),
  }).index('by_event', ['eventId']),

  // Who a host picked for a round set up with secretSanta.setup. Points at
  // guest list rows rather than users, since people who haven't replied yet
  // have no account linked. At draw time, the ones going become
  // secretSantaParticipants.
  secretSantaEntrants: defineTable({
    secretSantaId: v.id('secretSantas'),
    attendeeId: v.id('eventAttendees'),
  }).index('by_secretSanta', ['secretSantaId']),

  // "Keep these two apart" - neither draws the other. Becomes a pair of
  // secretSantaExclusions at draw time.
  secretSantaRules: defineTable({
    secretSantaId: v.id('secretSantas'),
    attendeeAId: v.id('eventAttendees'),
    attendeeBId: v.id('eventAttendees'),
  }).index('by_secretSanta', ['secretSantaId']),

  // A keep-apart pair remembered for a group, suggested whenever a later
  // event that the group is invited to sets up Secret Santa. `userAId` sorts
  // before `userBId`, so a pair is only ever stored once.
  groupKeepApartPairs: defineTable({
    groupId: v.id('groups'),
    userAId: v.string(), // Better Auth user id
    userBId: v.string(),
  }).index('by_group_userAId_userBId', ['groupId', 'userAId', 'userBId']),

  // The people actually in a round's draw: its entrants who were going when
  // names were drawn. Rewritten wholesale on every draw, rather than diffed.
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
    // The giver has their Match's gift ("Gift ready"). Shown to people in the
    // draw only as a count. Hosts of a Reviewed draw, who see every Match
    // anyway, also see who. Goes with the row when a draw is undone.
    giftReady: v.optional(v.boolean()),
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

  // Something a user should know about, shown as a card on their home screen
  // until they dismiss it.
  // - 'secretSantaUndone': a host undid an event's Secret Santa draw, so the
  //   match the user was sent no longer counts.
  // - 'secretSantaDrawn': no longer created - waiting to send the names is
  //   now a To-do (convex/toDos.ts). Old rows are hidden from `notices.mine`
  //   and cleared once the names are sent or the draw is undone.
  notices: defineTable({
    userId: v.string(), // Better Auth user id
    kind: v.union(v.literal('secretSantaUndone'), v.literal('secretSantaDrawn')),
    eventId: v.id('events'),
  })
    .index('by_user_event', ['userId', 'eventId'])
    .index('by_event', ['eventId']),

  // A conversation between people (see Thread in GLOSSARY.md). Who's in it
  // lives in threadMembers, so a thread can later hold more than two people.
  // `pairKey` is set on 1:1 threads only - the two user ids sorted and joined
  // with "|" - so there's at most one thread per pair.
  //
  // A Secret Santa Ask's thread has `assignmentId` (the giver's Match) and
  // `santaId` (the giver), and no `pairKey`. The giver is never named to the
  // other member. It's read-only once that assignment is gone (the draw was
  // undone), even if a redraw pairs them again.
  threads: defineTable({
    pairKey: v.optional(v.string()),
    lastMessageAt: v.number(),
    assignmentId: v.optional(v.id('secretSantaAssignments')),
    santaId: v.optional(v.string()), // Better Auth user id
  })
    .index('by_pairKey', ['pairKey'])
    .index('by_assignmentId', ['assignmentId']),

  // threads <-> users. `lastMessageAt` is copied from the thread so a user's
  // threads can be read newest first. `unreadCount` is messages from other
  // people since this member last opened the thread.
  threadMembers: defineTable({
    threadId: v.id('threads'),
    userId: v.string(), // Better Auth user id
    lastMessageAt: v.number(),
    unreadCount: v.number(),
  })
    .index('by_threadId_and_userId', ['threadId', 'userId'])
    .index('by_userId_and_lastMessageAt', ['userId', 'lastMessageAt']),

  // - 'text': a plain message.
  // - 'ask': the message an Ask was sent with. `askId` is set.
  // - 'listMade': the asked person made a list that answered the Ask. Written
  //   by the app, but `authorId` is the asked person, since it's their doing.
  messages: defineTable({
    threadId: v.id('threads'),
    authorId: v.string(), // Better Auth user id
    kind: v.union(v.literal('text'), v.literal('ask'), v.literal('listMade')),
    body: v.optional(v.string()),
    askId: v.optional(v.id('asks')),
  }).index('by_threadId', ['threadId']),

  // A request to one person for gift ideas (see Ask in GLOSSARY.md). Whether
  // it's still open is worked out when read (convex/asks.ts): it closes once
  // `answeredAt` is set, a week after the occasion, or while its event is
  // cancelled.
  asks: defineTable({
    threadId: v.id('threads'),
    askerId: v.string(), // Better Auth user id
    askedId: v.string(), // Better Auth user id
    // A Secret Santa Ask: always for its event, in its own thread, and kept
    // out of everyone else's view of who asked.
    secretSanta: v.optional(v.boolean()),
    // None = "No occasion". 'birthday' is the asked person's birthday.
    occasion: v.optional(askOccasionValidator),
    // Which Christmas or birthday it's for, e.g. "2026-12-25". Events use
    // the event's own date, which can change.
    occurrenceDate: v.optional(v.string()),
    // When the asked person had a list for the occasion with an item on it.
    answeredAt: v.optional(v.number()),
  })
    .index('by_askedId_and_answeredAt', ['askedId', 'answeredAt'])
    .index('by_askerId_and_askedId', ['askerId', 'askedId']),

  // To-dos someone dismissed. To-dos themselves aren't stored - they're
  // worked out from everything else (convex/toDos.ts) - so this only records
  // which ones not to show. `key` names one to-do for one occurrence, e.g.
  // "addIdeas:<listId>:2026-12-25", so a yearly one can come back next year.
  toDoDismissals: defineTable({
    userId: v.string(), // Better Auth user id
    key: v.string(),
  }).index('by_userId_and_key', ['userId', 'key']),
});
