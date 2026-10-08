import { v, ConvexError } from 'convex/values';
import { mutation, query, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getAttendance, requireManager } from './events';

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
// the viewer's role: a manager gets the full roster/exclusions/assignments
// (they already saw everything while setting it up), while a regular
// attendee only ever gets their own assignment - never anyone else's.
export const getState = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const attendance = await getAttendance(ctx, args.eventId, user._id);
    if (!attendance) return null;
    const isManager = attendance.role === 'owner' || attendance.role === 'manager';

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) {
      return { exists: false as const, isManager };
    }

    if (!isManager) {
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

      return {
        exists: true as const,
        isManager: false as const,
        status: secretSanta.status,
        isParticipant: !!myParticipation,
        myAssignment,
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
      participants: participants.map(p => hydrated.get(p.userId)!),
      exclusions: exclusions.map(e => ({ userId: e.userId, excludedUserId: e.excludedUserId })),
      assignments: assignments.map(a => ({
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
    await requireManager(ctx, args.eventId, user._id);

    const participantIds = [...new Set(args.participantUserIds)];
    if (participantIds.length < 2) {
      throw new ConvexError('Pick at least 2 participants.');
    }

    const attendees = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', args.eventId))
      .collect();
    const attendeeIds = new Set(attendees.map(a => a.userId));
    if (!participantIds.every(id => attendeeIds.has(id))) {
      throw new ConvexError('All participants must be attendees of this event.');
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
    await requireManager(ctx, args.eventId, user._id);

    if (args.giverAUserId === args.giverBUserId) {
      throw new ConvexError('Pick two different people to swap.');
    }

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta || secretSanta.status !== 'draft') {
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
    await requireManager(ctx, args.eventId, user._id);

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) throw new ConvexError('Set up Secret Santa first.');
    if (secretSanta.status === 'sent') throw new ConvexError('Secret Santa has already been sent.');

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

// Wipes the round so a manager can start over from scratch - the only way
// back once notifications have gone out, since `generate` refuses to touch a
// 'sent' round.
export const reset = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireManager(ctx, args.eventId, user._id);

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) return;

    await deleteSecretSantaChildren(ctx, secretSanta._id);
    await ctx.db.delete(secretSanta._id);
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
