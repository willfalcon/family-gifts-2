import { v, ConvexError } from 'convex/values';
import { mutation, query, internalQuery, internalMutation, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getAttendance, isHostRole, requireHost } from './events';
import { getMembership } from './groups';

// Random derangement respecting one-directional exclusions ("giver must not
// receive excludedUserId"). Tries plain random shuffles first (cheap, and
// succeeds almost always for realistic exclusion counts), then falls back to
// randomized backtracking, which is guaranteed to find a valid assignment if
// one exists. Returns null only when the exclusions make that impossible.
function computeAssignments(
  participantIds: string[],
  exclusions: { userId: string; excludedUserId: string }[]
): { giverUserId: string; receiverUserId: string }[] | null {
  const excludedPairs = new Set(exclusions.map(e => `${e.userId}|${e.excludedUserId}`));
  const isAllowed = (giver: string, receiver: string) => giver !== receiver && !excludedPairs.has(`${giver}|${receiver}`);

  for (let attempt = 0; attempt < 500; attempt++) {
    const shuffled = shuffle(participantIds);
    if (participantIds.every((giver, i) => isAllowed(giver, shuffled[i]))) {
      return participantIds.map((giver, i) => ({ giverUserId: giver, receiverUserId: shuffled[i] }));
    }
  }

  const givers = shuffle(participantIds);
  const used = new Set<string>();
  const result: { giverUserId: string; receiverUserId: string }[] = [];
  let nodesVisited = 0;

  function backtrack(index: number): boolean {
    if (nodesVisited++ > 200_000) return false;
    if (index === givers.length) return true;

    const giver = givers[index];
    const candidates = shuffle(participantIds.filter(r => !used.has(r) && isAllowed(giver, r)));
    for (const receiver of candidates) {
      used.add(receiver);
      result.push({ giverUserId: giver, receiverUserId: receiver });
      if (backtrack(index + 1)) return true;
      used.delete(receiver);
      result.pop();
    }
    return false;
  }

  return backtrack(0) ? result : null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function getSecretSanta(ctx: QueryCtx, eventId: Id<'events'>) {
  return await ctx.db
    .query('secretSantas')
    .withIndex('by_event', q => q.eq('eventId', eventId))
    .unique();
}

async function deleteSecretSantaChildren(ctx: MutationCtx, secretSantaId: Id<'secretSantas'>) {
  for await (const row of ctx.db.query('secretSantaParticipants').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
  for await (const row of ctx.db.query('secretSantaExclusions').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
  for await (const row of ctx.db.query('secretSantaAssignments').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
}

// The whole Secret Santa state for an event, shaped differently depending on
// the viewer's role: a host gets the full roster/exclusions/assignments
// (they already saw everything while setting it up), while a regular
// attendee only ever gets their own assignment - never anyone else's.
export const getState = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.eventId, user._id);
    if (!attendance) return null;
    const isManager = isHostRole(attendance.role);

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) {
      return { exists: false as const, isManager };
    }

    const myParticipation = await ctx.db
      .query('secretSantaParticipants')
      .withIndex('by_secretSanta_user', q => q.eq('secretSantaId', secretSanta._id).eq('userId', user._id))
      .unique();

    let myAssignment = null;
    if (secretSanta.status === 'sent' && myParticipation) {
      const assignment = await ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', user._id))
        .unique();
      if (assignment) {
        const receiver = await authComponent.getAnyUserById(ctx, assignment.receiverUserId);
        myAssignment = { userId: assignment.receiverUserId, name: receiver?.name ?? 'Unknown', image: receiver?.image ?? null };
      }
    }

    // Shown to everyone on the event.
    const details = {
      budget: secretSanta.budget ?? null,
      drawAt: secretSanta.drawAt ?? null,
      sentAt: secretSanta.sentAt ?? null,
    };

    if (!isManager) {
      return {
        exists: true as const,
        isManager: false as const,
        status: secretSanta.status,
        isParticipant: !!myParticipation,
        myAssignment,
        ...details,
      };
    }

    const [participants, exclusions, assignments] = await Promise.all([
      ctx.db
        .query('secretSantaParticipants')
        .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
        .collect(),
      ctx.db
        .query('secretSantaExclusions')
        .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
        .collect(),
      ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
        .collect(),
    ]);

    const userIds = new Set<string>();
    participants.forEach(p => userIds.add(p.userId));
    exclusions.forEach(e => {
      userIds.add(e.userId);
      userIds.add(e.excludedUserId);
    });

    const hydrated = new Map(
      await Promise.all(
        [...userIds].map(async userId => {
          const hydratedUser = await authComponent.getAnyUserById(ctx, userId);
          return [userId, { userId, name: hydratedUser?.name ?? 'Unknown', image: hydratedUser?.image ?? null }] as const;
        })
      )
    );

    return {
      exists: true as const,
      isManager: true as const,
      id: secretSanta._id,
      status: secretSanta.status,
      isParticipant: !!myParticipation,
      myAssignment,
      ...details,
      private: !!secretSanta.private,
      drawEarly: !!secretSanta.drawEarly,
      drawError: secretSanta.drawError ?? null,
      participants: participants.map(p => hydrated.get(p.userId)!),
      exclusions: exclusions.map(e => ({ userId: e.userId, excludedUserId: e.excludedUserId })),
      // In a private round nobody sees who drew whom, hosts included.
      assignments: (secretSanta.private ? [] : assignments).map(a => ({
        giverUserId: a.giverUserId,
        giverName: hydrated.get(a.giverUserId)?.name ?? 'Unknown',
        receiverUserId: a.receiverUserId,
        receiverName: hydrated.get(a.receiverUserId)?.name ?? 'Unknown',
      })),
    };
  },
});

// Sets (or resets) the roster and exclusions and generates a fresh set of
// matchups in one shot. Always a full replace rather than an incremental
// edit - re-running this after changing who's in is simpler and safer than
// trying to patch a previous round's participants/exclusions/assignments in
// place. Only usable while the round is still a draft.
export const generate = mutation({
  args: {
    eventId: v.id('events'),
    participantUserIds: v.array(v.string()),
    exclusions: v.array(v.object({ userId: v.string(), excludedUserId: v.string() })),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    const participantIds = [...new Set(args.participantUserIds)];
    if (participantIds.length < 2) {
      throw new ConvexError('Pick at least 2 participants.');
    }

    const attendees = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();
    // Only people who are going can be drawn.
    const goingIds = new Set(attendees.flatMap(a => (a.userId && a.status === 'going' ? [a.userId] : [])));
    if (!participantIds.every(id => goingIds.has(id))) {
      throw new ConvexError('Everyone in Secret Santa has to be going to the event.');
    }

    for (const { userId, excludedUserId } of args.exclusions) {
      if (userId === excludedUserId || !participantIds.includes(userId) || !participantIds.includes(excludedUserId)) {
        throw new ConvexError('Exclusions must be between two different selected participants.');
      }
    }

    const assignments = computeAssignments(participantIds, args.exclusions);
    if (!assignments) {
      throw new ConvexError("Couldn't find a valid set of matches with these exclusions - try removing one.");
    }

    let secretSanta = await getSecretSanta(ctx, args.eventId);
    if (secretSanta && secretSanta.status === 'sent') {
      throw new ConvexError('Secret Santa has already been sent - reset it to start over.');
    }
    if (secretSanta?.private) {
      throw new ConvexError('This Secret Santa was set up in the app - reset it to start over.');
    }
    if (!secretSanta) {
      const secretSantaId = await ctx.db.insert('secretSantas', { eventId: args.eventId, status: 'draft', createdBy: user._id });
      secretSanta = await ctx.db.get(secretSantaId);
    }
    const secretSantaId = secretSanta!._id;

    await deleteSecretSantaChildren(ctx, secretSantaId);

    for (const userId of participantIds) {
      await ctx.db.insert('secretSantaParticipants', { secretSantaId, userId });
    }
    for (const { userId, excludedUserId } of args.exclusions) {
      await ctx.db.insert('secretSantaExclusions', { secretSantaId, userId, excludedUserId });
    }
    for (const { giverUserId, receiverUserId } of assignments) {
      await ctx.db.insert('secretSantaAssignments', { secretSantaId, giverUserId, receiverUserId });
    }

    return secretSantaId;
  },
});

// Swaps two givers' assigned recipients. Swapping (rather than reassigning
// one giver freely) keeps the result a valid permutation by construction -
// the only thing left to check is that neither swapped pairing breaks an
// exclusion or assigns someone to themselves.
export const swap = mutation({
  args: { eventId: v.id('events'), giverAUserId: v.string(), giverBUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    if (args.giverAUserId === args.giverBUserId) {
      throw new ConvexError('Pick two different people to swap.');
    }

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta || secretSanta.status !== 'draft' || secretSanta.private) {
      throw new ConvexError('Generate matches before making changes.');
    }

    const [assignmentA, assignmentB] = await Promise.all([
      ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', args.giverAUserId))
        .unique(),
      ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', args.giverBUserId))
        .unique(),
    ]);
    if (!assignmentA || !assignmentB) {
      throw new ConvexError('Assignment not found.');
    }

    const exclusions = await ctx.db
      .query('secretSantaExclusions')
      .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
      .collect();
    const isExcluded = (giver: string, receiver: string) => exclusions.some(e => e.userId === giver && e.excludedUserId === receiver);

    const newReceiverForA = assignmentB.receiverUserId;
    const newReceiverForB = assignmentA.receiverUserId;
    if (
      newReceiverForA === args.giverAUserId ||
      newReceiverForB === args.giverBUserId ||
      isExcluded(args.giverAUserId, newReceiverForA) ||
      isExcluded(args.giverBUserId, newReceiverForB)
    ) {
      throw new ConvexError("Can't swap these two - it would break an exclusion or match someone with themselves.");
    }

    await ctx.db.patch(assignmentA._id, { receiverUserId: newReceiverForA });
    await ctx.db.patch(assignmentB._id, { receiverUserId: newReceiverForB });
  },
});

// Locks in the round and schedules each participant's assignment email. Each
// giver only ever learns their own recipient - the email is sent
// individually per assignment, never as a shared list.
export const send = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) throw new ConvexError('Set up Secret Santa first.');
    if (secretSanta.status === 'sent') throw new ConvexError('Secret Santa has already been sent.');
    if (secretSanta.private) throw new ConvexError('Names are drawn automatically for this Secret Santa.');

    const assignments = await ctx.db
      .query('secretSantaAssignments')
      .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
      .collect();
    if (assignments.length === 0) throw new ConvexError('Generate matches first.');

    await ctx.db.patch(secretSanta._id, { status: 'sent', sentAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.sendSecretSantaAssignmentEmail.sendSecretSantaAssignmentEmails, {
      secretSantaId: secretSanta._id,
    });
  },
});

// Wipes the round so a host can start over from scratch - the only way
// back once notifications have gone out, since `generate` refuses to touch a
// 'sent' round.
export const reset = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    await deleteSecretSanta(ctx, args.eventId);
  },
});

// Feeds the Node action that renders and sends assignment emails; actions
// have no ctx.db, so this is the only way for it to read the data it needs.
export const getAssignmentEmailData = internalQuery({
  args: { secretSantaId: v.id('secretSantas') },
  handler: async (ctx, args) => {
    const secretSanta = await ctx.db.get(args.secretSantaId);
    if (!secretSanta) return null;
    const event = await ctx.db.get(secretSanta.eventId);
    if (!event) return null;

    const assignments = await ctx.db
      .query('secretSantaAssignments')
      .withIndex('by_secretSanta', q => q.eq('secretSantaId', args.secretSantaId))
      .collect();

    const emails = await Promise.all(
      assignments.map(async a => {
        const giver = await authComponent.getAnyUserById(ctx, a.giverUserId);
        const receiver = await authComponent.getAnyUserById(ctx, a.receiverUserId);
        if (!giver) return null;
        return {
          toEmail: giver.email.toLowerCase(),
          toName: giver.name ?? 'there',
          assigneeName: receiver?.name ?? 'Unknown',
        };
      })
    );

    return { eventId: event._id, eventName: event.name, emails: emails.filter(e => e !== null) };
  },
});

// ---------------------------------------------------------------------------
// The app's draw flow: a host picks who's in, a budget, keep-apart rules and
// when to draw (secretSanta.setup). Names are then drawn right away, at the
// chosen time, or as soon as everyone has replied. These rounds are private -
// nobody, hosts included, can see who drew whom.
// ---------------------------------------------------------------------------

// Deletes an event's round and everything under it, and cancels a pending
// draw. Used by reset and by events.remove.
export async function deleteSecretSanta(ctx: MutationCtx, eventId: Id<'events'>) {
  const secretSanta = await getSecretSanta(ctx, eventId);
  if (!secretSanta) return;

  await cancelScheduledDraw(ctx, secretSanta);
  await deleteSecretSantaChildren(ctx, secretSanta._id);
  for await (const row of ctx.db.query('secretSantaEntrants').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
    await ctx.db.delete(row._id);
  }
  for await (const row of ctx.db.query('secretSantaRules').withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(secretSanta._id);
}

// Only cancels a draw that hasn't started - cancelling the draw that's
// running would also cancel the emails it schedules.
async function cancelScheduledDraw(ctx: MutationCtx, secretSanta: Doc<'secretSantas'>) {
  if (!secretSanta.scheduledDrawId) return;
  const job = await ctx.db.system.get(secretSanta.scheduledDrawId);
  if (job?.state.kind === 'pending') await ctx.scheduler.cancel(secretSanta.scheduledDrawId);
}

// The round's entrants' guest list rows, leaving out anyone since removed.
async function getEntrantRows(ctx: QueryCtx, secretSanta: Doc<'secretSantas'>) {
  const entrants = await ctx.db
    .query('secretSantaEntrants')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
    .collect();
  const rows = await Promise.all(entrants.map(e => ctx.db.get(e.attendeeId)));
  return rows.flatMap(row => (row && row.eventId === secretSanta.eventId ? [row] : []));
}

// Draws names: entrants who are going become the participants, keep-apart
// rules become exclusions both ways, and everyone is emailed their match.
// Returns why it couldn't draw, writing nothing in that case.
async function draw(ctx: MutationCtx, secretSanta: Doc<'secretSantas'>): Promise<string | null> {
  const going = (await getEntrantRows(ctx, secretSanta)).flatMap(row =>
    row.status === 'going' && row.userId ? [{ attendeeId: row._id, userId: row.userId }] : []
  );
  const userIdByAttendee = new Map(going.map(g => [g.attendeeId as string, g.userId]));
  const participantIds = [...new Set(going.map(g => g.userId))];
  if (participantIds.length < 2) {
    return 'At least 2 people in the draw need to be going.';
  }

  const rules = await ctx.db
    .query('secretSantaRules')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
    .collect();
  const exclusions = rules.flatMap(rule => {
    const a = userIdByAttendee.get(rule.attendeeAId);
    const b = userIdByAttendee.get(rule.attendeeBId);
    return a && b && a !== b
      ? [
          { userId: a, excludedUserId: b },
          { userId: b, excludedUserId: a },
        ]
      : [];
  });

  const assignments = computeAssignments(participantIds, exclusions);
  if (!assignments) {
    return "Couldn't draw names with these rules. Try removing one.";
  }

  await deleteSecretSantaChildren(ctx, secretSanta._id);
  for (const userId of participantIds) {
    await ctx.db.insert('secretSantaParticipants', { secretSantaId: secretSanta._id, userId });
  }
  for (const exclusion of exclusions) {
    await ctx.db.insert('secretSantaExclusions', { secretSantaId: secretSanta._id, ...exclusion });
  }
  for (const assignment of assignments) {
    await ctx.db.insert('secretSantaAssignments', { secretSantaId: secretSanta._id, ...assignment });
  }

  await cancelScheduledDraw(ctx, secretSanta);
  await ctx.db.patch(secretSanta._id, {
    status: 'sent',
    sentAt: Date.now(),
    scheduledDrawId: undefined,
    drawError: undefined,
  });
  await ctx.scheduler.runAfter(0, internal.sendSecretSantaAssignmentEmail.sendSecretSantaAssignmentEmails, {
    secretSantaId: secretSanta._id,
  });
  return null;
}

// For a round set to draw early: draws once nobody in it is still to reply.
// Called whenever an event's guest list changes (an invite answered,
// revoked or removed). Never throws - a failed draw is saved on the round
// for hosts to see, and the scheduled draw still tries again later.
export async function drawIfEveryoneReplied(ctx: MutationCtx, eventId: Id<'events'>) {
  const secretSanta = await getSecretSanta(ctx, eventId);
  if (!secretSanta || secretSanta.status !== 'draft' || !secretSanta.drawEarly) return;

  const rows = await getEntrantRows(ctx, secretSanta);
  if (rows.some(row => row.status === 'invited')) return;

  const error = await draw(ctx, secretSanta);
  if (error) await ctx.db.patch(secretSanta._id, { drawError: error });
}

export const drawScheduled = internalMutation({
  args: { secretSantaId: v.id('secretSantas') },
  handler: async (ctx, args) => {
    const secretSanta = await ctx.db.get(args.secretSantaId);
    if (!secretSanta || secretSanta.status !== 'draft') return null;
    const error = await draw(ctx, secretSanta);
    if (error) await ctx.db.patch(secretSanta._id, { drawError: error, scheduledDrawId: undefined });
    return null;
  },
});

// A group's members as accounts, so unanswered invites (known only by email)
// can be matched to a person.
async function getGroupMemberUsers(ctx: QueryCtx, groupId: Id<'groups'>) {
  const members = await ctx.db
    .query('groupMembers')
    .withIndex('by_group', q => q.eq('groupId', groupId))
    .collect();
  const users = await Promise.all(
    members.map(async member => {
      const memberUser = await authComponent.getAnyUserById(ctx, member.userId);
      return memberUser ? { userId: member.userId, email: memberUser.email.toLowerCase(), name: memberUser.name } : null;
    })
  );
  return users.filter(u => u !== null);
}

// The account behind a guest list row: its user, or for an unanswered
// invite, whichever of `knownUsers` has its email.
function resolveUserId(row: Doc<'eventAttendees'>, knownUsers: { userId: string; email: string }[]) {
  if (row.userId) return row.userId;
  return knownUsers.find(u => u.email === row.email)?.userId ?? null;
}

function sortPair(a: string, b: string) {
  return a < b ? ([a, b] as const) : ([b, a] as const);
}

// Everything the Secret Santa setup sheet needs: the whole guest list with
// how each person answered, the groups invited to the event (with which
// guests are in each, for "Remember for <group>"), and keep-apart pairs
// remembered for those groups. Hosts only.
export const setupOptions = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.eventId, user._id);
    if (!attendance || !isHostRole(attendance.role)) return null;

    const rows = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();

    // Only groups the host is in - remembering a pair for a group needs that.
    const groupInvites = await ctx.db
      .query('eventGroupInvites')
      .withIndex('by_event_group', q => q.eq('eventId', args.eventId))
      .collect();
    const groups = (
      await Promise.all(
        groupInvites.map(async invite => {
          const group = await ctx.db.get(invite.groupId);
          if (!group || !(await getMembership(ctx, group._id, user._id))) return null;
          return { group, members: await getGroupMemberUsers(ctx, group._id) };
        })
      )
    ).filter(g => g !== null);
    const knownUsers = groups.flatMap(g => g.members);

    const people = await Promise.all(
      rows.map(async row => {
        const userId = resolveUserId(row, knownUsers);
        const account = row.userId ? await authComponent.getAnyUserById(ctx, row.userId) : null;
        const name = account?.name ?? knownUsers.find(u => u.userId === userId)?.name ?? row.email ?? 'Unknown';
        return {
          attendeeId: row._id,
          userId,
          name,
          color: row.color,
          role: row.role,
          status: row.status,
          isMe: row.userId === user._id,
        };
      })
    );
    const attendeeIdByUser = new Map(people.flatMap(p => (p.userId ? [[p.userId, p.attendeeId] as const] : [])));

    const suggestedRules: { attendeeAId: Id<'eventAttendees'>; attendeeBId: Id<'eventAttendees'>; groupId: Id<'groups'> }[] = [];
    const seen = new Set<string>();
    for (const { group } of groups) {
      for await (const pair of ctx.db
        .query('groupKeepApartPairs')
        .withIndex('by_group_userAId_userBId', q => q.eq('groupId', group._id))) {
        const a = attendeeIdByUser.get(pair.userAId);
        const b = attendeeIdByUser.get(pair.userBId);
        const key = `${pair.userAId}|${pair.userBId}`;
        if (a && b && !seen.has(key)) {
          seen.add(key);
          suggestedRules.push({ attendeeAId: a, attendeeBId: b, groupId: group._id });
        }
      }
    }

    return {
      people,
      groups: groups.map(({ group, members }) => {
        const memberIds = new Set(members.map(m => m.userId));
        return {
          groupId: group._id,
          name: group.name,
          attendeeIds: people.filter(p => p.userId && memberIds.has(p.userId)).map(p => p.attendeeId),
        };
      }),
      suggestedRules,
    };
  },
});

// Saves a keep-apart pair on a group for future draws. Quietly skips it
// unless the host and both people are in the group.
async function rememberPair(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  hostUserId: string,
  rowA: Doc<'eventAttendees'>,
  rowB: Doc<'eventAttendees'>
) {
  if (!(await getMembership(ctx, groupId, hostUserId))) return;
  const members = await getGroupMemberUsers(ctx, groupId);
  const a = resolveUserId(rowA, members);
  const b = resolveUserId(rowB, members);
  const memberIds = new Set(members.map(m => m.userId));
  if (!a || !b || a === b || !memberIds.has(a) || !memberIds.has(b)) return;

  const [userAId, userBId] = sortPair(a, b);
  const existing = await ctx.db
    .query('groupKeepApartPairs')
    .withIndex('by_group_userAId_userBId', q => q.eq('groupId', groupId).eq('userAId', userAId).eq('userBId', userBId))
    .first();
  if (!existing) await ctx.db.insert('groupKeepApartPairs', { groupId, userAId, userBId });
}

// Sets up Secret Santa for an event. With no `drawAt` (or one already
// past), names are drawn now - only people going are in. Otherwise the draw
// is scheduled, and with `drawEarly` happens as soon as everyone picked has
// replied.
export const setup = mutation({
  args: {
    eventId: v.id('events'),
    attendeeIds: v.array(v.id('eventAttendees')),
    budget: v.optional(v.number()),
    rules: v.array(
      v.object({
        attendeeAId: v.id('eventAttendees'),
        attendeeBId: v.id('eventAttendees'),
        rememberForGroupId: v.optional(v.id('groups')),
      })
    ),
    drawAt: v.optional(v.number()),
    drawEarly: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    if (await getSecretSanta(ctx, args.eventId)) {
      throw new ConvexError('Secret Santa is already set up for this event.');
    }

    const attendeeIds = [...new Set(args.attendeeIds)];
    const rows = new Map<string, Doc<'eventAttendees'>>();
    for (const id of attendeeIds) {
      const row = await ctx.db.get(id);
      if (!row || row.eventId !== args.eventId) throw new ConvexError('Someone in the draw is no longer on the event.');
      rows.set(id, row);
    }
    if (attendeeIds.length < 2) throw new ConvexError('Pick at least 2 people.');

    if (args.budget !== undefined && (!Number.isFinite(args.budget) || args.budget < 0)) {
      throw new ConvexError('Enter a spending limit of $0 or more.');
    }

    for (const rule of args.rules) {
      if (rule.attendeeAId === rule.attendeeBId || !rows.has(rule.attendeeAId) || !rows.has(rule.attendeeBId)) {
        throw new ConvexError('Each rule needs two different people in the draw.');
      }
    }

    const drawLater = args.drawAt !== undefined && args.drawAt > Date.now();
    const secretSantaId = await ctx.db.insert('secretSantas', {
      eventId: args.eventId,
      status: 'draft',
      createdBy: user._id,
      private: true,
      budget: args.budget,
      drawAt: drawLater ? args.drawAt : undefined,
      drawEarly: drawLater ? args.drawEarly : undefined,
    });

    for (const attendeeId of attendeeIds) {
      await ctx.db.insert('secretSantaEntrants', { secretSantaId, attendeeId });
    }
    for (const { attendeeAId, attendeeBId, rememberForGroupId } of args.rules) {
      await ctx.db.insert('secretSantaRules', { secretSantaId, attendeeAId, attendeeBId });
      if (rememberForGroupId) {
        await rememberPair(ctx, rememberForGroupId, user._id, rows.get(attendeeAId)!, rows.get(attendeeBId)!);
      }
    }

    if (!drawLater) {
      const error = await draw(ctx, (await ctx.db.get(secretSantaId))!);
      // Throwing rolls back the whole setup, so the host can fix it and retry.
      if (error) throw new ConvexError(error);
      return secretSantaId;
    }

    const scheduledDrawId = await ctx.scheduler.runAt(args.drawAt!, internal.secretSanta.drawScheduled, { secretSantaId });
    await ctx.db.patch(secretSantaId, { scheduledDrawId });
    // Everyone may already have replied.
    await drawIfEveryoneReplied(ctx, args.eventId);
    return secretSantaId;
  },
});
