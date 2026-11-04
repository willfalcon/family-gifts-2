import { v, ConvexError } from 'convex/values';
import { mutation, query, internalQuery, internalMutation, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { AVATAR_COLORS } from './avatarColors';
import { getAttendance, isHostRole, requireHost } from './events';
import { getMembership } from './groups';
import { hasListAccess } from './listShares';
import { getFirstName } from './profiles';
import { swapProblem } from '../../shared/secret-santa';
import { addSecretSantaDrawnNotices, addSecretSantaUndoneNotice, clearSecretSantaDrawnNotices } from './notices';

// Random derangement respecting one-directional exclusions ("giver must not
// receive excludedUserId"). Tries plain random shuffles first (cheap, and
// succeeds almost always for realistic exclusion counts), then falls back to
// randomized backtracking, which is guaranteed to find a valid assignment if
// one exists. Returns null only when the exclusions make that impossible.
function computeAssignments(
  participantIds: string[],
  exclusions: { userId: string; excludedUserId: string }[],
): { giverUserId: string; receiverUserId: string }[] | null {
  const excludedPairs = new Set(exclusions.map(e => `${e.userId}|${e.excludedUserId}`));
  const isAllowed = (giver: string, receiver: string) =>
    giver !== receiver && !excludedPairs.has(`${giver}|${receiver}`);

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
  for await (const row of ctx.db
    .query('secretSantaParticipants')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
  for await (const row of ctx.db
    .query('secretSantaExclusions')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
  for await (const row of ctx.db
    .query('secretSantaAssignments')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
}

// The whole Secret Santa state for an event, shaped differently depending on
// the viewer's role: a host gets the roster and rules, plus every Match in a
// Reviewed draw, while a regular attendee only ever gets their own Match -
// never anyone else's. To guests a Reviewed draw that hasn't been sent yet
// looks the same as one that hasn't been drawn.
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
        const [receiver, receiverAttendance] = await Promise.all([
          authComponent.getAnyUserById(ctx, assignment.receiverUserId),
          getAttendance(ctx, args.eventId, assignment.receiverUserId),
        ]);
        myAssignment = {
          userId: assignment.receiverUserId,
          name: receiver?.name ?? 'Unknown',
          image: receiver?.image ?? null,
          // Their avatar color on this event, so it matches the guest list.
          color: receiverAttendance?.color ?? AVATAR_COLORS[0].hex,
          giftReady: !!assignment.giftReady,
        };
      }
    }

    const mode = secretSanta.mode ?? 'secret';

    // How many in the draw are Gift ready, for people in the draw and for
    // hosts of a sent Reviewed draw. Only the count: hosts of a Reviewed draw
    // also see who (in `assignments` below), since they already know every
    // Match. Nobody else ever does.
    let giftProgress: { ready: number; total: number } | null = null;
    if (myAssignment || (isManager && mode === 'reviewed' && secretSanta.status === 'sent')) {
      giftProgress = { ready: 0, total: 0 };
      for await (const row of ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
        giftProgress.total++;
        if (row.giftReady) giftProgress.ready++;
      }
    }

    // Shown to everyone on the event.
    const details = {
      mode,
      budget: secretSanta.budget ?? null,
      drawAt: secretSanta.drawAt ?? null,
      sentAt: secretSanta.sentAt ?? null,
      // A host undid a draw whose names had been sent, and hasn't drawn again yet.
      undone: secretSanta.status === 'draft' && !!secretSanta.undoneAt,
    };

    if (!isManager) {
      return {
        exists: true as const,
        isManager: false as const,
        status: secretSanta.status === 'drawn' ? ('draft' as const) : secretSanta.status,
        isParticipant: !!myParticipation,
        myAssignment,
        giftProgress,
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
          const [hydratedUser, userAttendance] = await Promise.all([
            authComponent.getAnyUserById(ctx, userId),
            getAttendance(ctx, args.eventId, userId),
          ]);
          const name = hydratedUser?.name ?? 'Unknown';
          return [
            userId,
            {
              userId,
              name,
              firstName: hydratedUser ? await getFirstName(ctx, userId, name) : name,
              image: hydratedUser?.image ?? null,
              // Their avatar color on this event, so it matches the guest list.
              color: userAttendance?.color ?? AVATAR_COLORS[0].hex,
            },
          ] as const;
        }),
      ),
    );

    return {
      exists: true as const,
      isManager: true as const,
      id: secretSanta._id,
      status: secretSanta.status,
      isParticipant: !!myParticipation,
      myAssignment,
      giftProgress,
      ...details,
      drawnAt: secretSanta.drawnAt ?? null,
      drawEarly: !!secretSanta.drawEarly,
      drawError: secretSanta.drawError ?? null,
      participants: participants.map(p => hydrated.get(p.userId)!),
      exclusions: exclusions.map(e => ({ userId: e.userId, excludedUserId: e.excludedUserId })),
      // In a Secret draw nobody sees who drew whom, hosts included. First
      // names only, to keep the review list short.
      assignments: (mode === 'reviewed' ? assignments : []).map(a => ({
        giverUserId: a.giverUserId,
        giverName: hydrated.get(a.giverUserId)?.firstName ?? 'Unknown',
        giverColor: hydrated.get(a.giverUserId)?.color ?? AVATAR_COLORS[0].hex,
        receiverUserId: a.receiverUserId,
        receiverName: hydrated.get(a.receiverUserId)?.firstName ?? 'Unknown',
        receiverColor: hydrated.get(a.receiverUserId)?.color ?? AVATAR_COLORS[0].hex,
        giftReady: !!a.giftReady,
      })),
    };
  },
});

const MATCH_ITEM_COUNT = 3;

type MatchItemStatus = 'mine' | 'available' | 'overBudget' | 'claimed';
const STATUS_RANK: Record<MatchItemStatus, number> = { mine: 0, available: 1, overBudget: 2, claimed: 3 };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

// A list's items with where each stands for the viewer: claimed by them,
// still available, over the budget, or fully claimed by others.
async function matchItemsForList(ctx: QueryCtx, list: Doc<'lists'>, viewerId: string, budget: number | null) {
  const claims = new Map<string, { total: number; mine: number; others: string[] }>();
  for await (const claim of ctx.db.query('claims').withIndex('by_list', q => q.eq('listId', list._id))) {
    const entry = claims.get(claim.itemId) ?? { total: 0, mine: 0, others: [] };
    entry.total += claim.quantity;
    if (claim.userId === viewerId) entry.mine += claim.quantity;
    else entry.others.push(claim.userId);
    claims.set(claim.itemId, entry);
  }

  const items = await ctx.db
    .query('items')
    .withIndex('by_listId', q => q.eq('listId', list._id))
    .collect();
  return items.map(item => {
    const claim = claims.get(item._id);
    const fullyClaimed = (claim?.total ?? 0) >= Math.max(1, item.quantity ?? 1);
    // An item with no price can't be said to be over the budget.
    const overBudget = budget != null && item.price != null && item.price > budget;
    const status: MatchItemStatus = claim?.mine
      ? 'mine'
      : fullyClaimed
        ? 'claimed'
        : overBudget
          ? 'overBudget'
          : 'available';
    return { item, list, status, claimerIds: claim?.others ?? [] };
  });
}

type MatchItem = Awaited<ReturnType<typeof matchItemsForList>>[number];

// Your own claims first, then what you could still get, then what's over the
// budget, then what's taken. Within each: highest priority, then the price
// closest to the budget (unpriced items last), then oldest first.
function compareMatchItems(budget: number | null) {
  const distance = (price: number | undefined) =>
    budget == null ? 0 : price == null ? Infinity : Math.abs(budget - price);
  return (a: MatchItem, b: MatchItem) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    PRIORITY_RANK[a.item.priority ?? 'medium'] - PRIORITY_RANK[b.item.priority ?? 'medium'] ||
    distance(a.item.price) - distance(b.item.price) ||
    a.item._creationTime - b.item._creationTime;
}

const isGettable = (row: MatchItem) => row.status === 'mine' || row.status === 'available';

// A few items to suggest for your Match, once names are drawn. From their list
// for this event when they have one (several: the one with the most you could
// still get, newest on a tie), including ones you can't get, so you see why.
// Otherwise only items you could get, from their other lists you can see.
// Null if you have no Match.
export const matchItems = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta || secretSanta.status !== 'sent') return null;
    const assignment = await ctx.db
      .query('secretSantaAssignments')
      .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', user._id))
      .unique();
    if (!assignment) return null;
    const matchId = assignment.receiverUserId;
    const budget = secretSanta.budget ?? null;
    const compare = compareMatchItems(budget);

    const eventLists = (
      await ctx.db
        .query('lists')
        .withIndex('by_occasion_event', q => q.eq('occasion.eventId', args.eventId))
        .collect()
    ).filter(list => list.createdBy === matchId && list.archivedAt === undefined);

    let rows: MatchItem[];
    let eventList: Doc<'lists'> | null = null;
    if (eventLists.length > 0) {
      const perList = await Promise.all(eventLists.map(list => matchItemsForList(ctx, list, user._id, budget)));
      let best = 0;
      perList.forEach((listRows, i) => {
        const gettable = listRows.filter(isGettable).length;
        const bestGettable = perList[best].filter(isGettable).length;
        if (
          gettable > bestGettable ||
          (gettable === bestGettable && eventLists[i]._creationTime > eventLists[best]._creationTime)
        ) {
          best = i;
        }
      });
      eventList = eventLists[best];
      rows = perList[best];
    } else {
      const lists = await ctx.db
        .query('lists')
        .withIndex('by_createdBy_archivedAt', q => q.eq('createdBy', matchId).eq('archivedAt', undefined))
        .collect();
      const visible = [];
      for (const list of lists) {
        if (await hasListAccess(ctx, list, user._id)) visible.push(list);
      }
      rows = (await Promise.all(visible.map(list => matchItemsForList(ctx, list, user._id, budget))))
        .flat()
        .filter(isGettable);
    }

    const top = rows.sort(compare).slice(0, MATCH_ITEM_COUNT);
    const names = new Map<string, string>();
    const nameOf = async (userId: string) => {
      if (!names.has(userId)) {
        names.set(userId, (await authComponent.getAnyUserById(ctx, userId))?.name ?? 'Someone');
      }
      return names.get(userId)!;
    };

    return {
      eventList: eventList && { _id: eventList._id, title: eventList.title },
      items: await Promise.all(
        top.map(async ({ item, list, status, claimerIds }) => ({
          _id: item._id,
          listId: list._id,
          listTitle: list.title,
          name: item.name,
          price: item.price ?? null,
          priority: item.priority ?? null,
          imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
          status,
          claimedBy: await Promise.all(claimerIds.map(nameOf)),
        })),
      ),
    };
  },
});

// Swaps two givers' Matches, while a Reviewed draw is Drawn, not sent.
// Swapping (rather than reassigning one giver freely) keeps everyone giving
// and receiving exactly once - the only thing left to check is that nobody
// ends up giving to themselves or to someone they're kept apart from.
export const swap = mutation({
  args: { eventId: v.id('events'), giverAUserId: v.string(), giverBUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    if (args.giverAUserId === args.giverBUserId) {
      throw new ConvexError('Pick two different people to swap.');
    }

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta || secretSanta.status !== 'drawn') {
      throw new ConvexError('Matches can only be changed before the names are sent.');
    }

    const [assignmentA, assignmentB] = await Promise.all([
      ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta_giver', q =>
          q.eq('secretSantaId', secretSanta._id).eq('giverUserId', args.giverAUserId),
        )
        .unique(),
      ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta_giver', q =>
          q.eq('secretSantaId', secretSanta._id).eq('giverUserId', args.giverBUserId),
        )
        .unique(),
    ]);
    if (!assignmentA || !assignmentB) {
      throw new ConvexError('Assignment not found.');
    }

    const exclusions = await ctx.db
      .query('secretSantaExclusions')
      .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
      .collect();
    const problem = swapProblem(assignmentA, assignmentB, exclusions);
    if (problem) {
      throw new ConvexError(
        problem.kind === 'self'
          ? 'Can’t swap these two. Someone would be giving to themselves.'
          : 'Can’t swap these two. It would match two people who are kept apart.',
      );
    }

    const newReceiverForA = assignmentB.receiverUserId;
    const newReceiverForB = assignmentA.receiverUserId;
    await ctx.db.patch(assignmentA._id, { receiverUserId: newReceiverForA });
    await ctx.db.patch(assignmentB._id, { receiverUserId: newReceiverForB });
  },
});

// Marks whether you have your Match's gift ("Gift ready"). Only your own row,
// and only once names are drawn.
export const setGiftReady = mutation({
  args: { eventId: v.id('events'), giftReady: v.boolean() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta || secretSanta.status !== 'sent') {
      throw new ConvexError('Names haven’t been drawn yet.');
    }
    const assignment = await ctx.db
      .query('secretSantaAssignments')
      .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', user._id))
      .unique();
    if (!assignment) throw new ConvexError('You’re not in this Secret Santa.');
    await ctx.db.patch(assignment._id, { giftReady: args.giftReady });
  },
});

// Sends the names for a Reviewed draw: each person in the draw is emailed
// their own Match - individually, never as a shared list.
export const send = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) throw new ConvexError('Set up Secret Santa first.');
    if (secretSanta.status === 'sent') throw new ConvexError('The names have already been sent.');
    if (secretSanta.status !== 'drawn') throw new ConvexError('Names haven’t been drawn yet.');

    await sendNames(ctx, secretSanta);
    await clearSecretSantaDrawnNotices(ctx, args.eventId);
  },
});

async function sendNames(ctx: MutationCtx, secretSanta: Doc<'secretSantas'>) {
  await ctx.db.patch(secretSanta._id, { status: 'sent', sentAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.sendSecretSantaAssignmentEmail.sendSecretSantaAssignmentEmails, {
    secretSantaId: secretSanta._id,
  });
}

// Wipes the round so a host can start over from scratch.
export const reset = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    await deleteSecretSanta(ctx, args.eventId);
  },
});

// Takes back a draw: everyone's match is cleared, but who's in, the
// keep-apart rules and the budget are kept so the host can draw again from
// the setup screen. If the names had been sent, everyone who was in the draw
// (other than this host) gets a notice on their home screen that their old
// match no longer counts. If they hadn't, nobody knew, so nobody is told.
export const undoDraw = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    const secretSanta = await getSecretSanta(ctx, args.eventId);
    if (!secretSanta) throw new ConvexError('There’s no Secret Santa on this event.');
    if (secretSanta.status === 'draft') throw new ConvexError('Names haven’t been drawn yet.');
    const wasSent = secretSanta.status === 'sent';

    if (wasSent) {
      for await (const participant of ctx.db
        .query('secretSantaParticipants')
        .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))) {
        if (participant.userId !== user._id) {
          await addSecretSantaUndoneNotice(ctx, participant.userId, args.eventId);
        }
      }
    }
    await clearSecretSantaDrawnNotices(ctx, args.eventId);

    await deleteSecretSantaChildren(ctx, secretSanta._id);
    await ctx.db.patch(secretSanta._id, {
      status: 'draft',
      drawnAt: undefined,
      sentAt: undefined,
      drawAt: undefined,
      drawEarly: undefined,
      drawError: undefined,
      undoneAt: wasSent ? Date.now() : secretSanta.undoneAt,
    });
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
      }),
    );

    return { eventId: event._id, eventName: event.name, emails: emails.filter(e => e !== null) };
  },
});

// ---------------------------------------------------------------------------
// The draw flow: a host picks who's in, a budget, keep-apart rules, whether
// it's a Secret or Reviewed draw, and when to draw (secretSanta.setup). Names
// are then drawn right away, at the chosen time, or as soon as everyone has
// replied. A Secret draw sends the names as it draws; a Reviewed draw waits
// for a host to send them.
// ---------------------------------------------------------------------------

// Deletes an event's round and everything under it, and cancels a pending
// draw. Used by reset and by events.remove.
export async function deleteSecretSanta(ctx: MutationCtx, eventId: Id<'events'>) {
  const secretSanta = await getSecretSanta(ctx, eventId);
  if (!secretSanta) return;

  await cancelScheduledDraw(ctx, secretSanta);
  await deleteSecretSantaChildren(ctx, secretSanta._id);
  await deleteEntrantsAndRules(ctx, secretSanta._id);
  await clearSecretSantaDrawnNotices(ctx, eventId);
  await ctx.db.delete(secretSanta._id);
}

// Who the host picked and the keep-apart rules - what secretSanta.setup writes.
async function deleteEntrantsAndRules(ctx: MutationCtx, secretSantaId: Id<'secretSantas'>) {
  for await (const row of ctx.db
    .query('secretSantaEntrants')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
  for await (const row of ctx.db
    .query('secretSantaRules')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSantaId))) {
    await ctx.db.delete(row._id);
  }
}

// Only cancels a draw that hasn't started - cancelling the draw that's
// running would also cancel the emails it schedules.
async function cancelScheduledDraw(ctx: MutationCtx, secretSanta: Doc<'secretSantas'>) {
  if (!secretSanta.scheduledDrawId) return;
  const job = await ctx.db.system.get(secretSanta.scheduledDrawId);
  if (job?.state.kind === 'pending') await ctx.scheduler.cancel(secretSanta.scheduledDrawId);
}

// The round's entrants' guest list rows, leaving out anyone since removed or
// whose invite was revoked.
async function getEntrantRows(ctx: QueryCtx, secretSanta: Doc<'secretSantas'>) {
  const entrants = await ctx.db
    .query('secretSantaEntrants')
    .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
    .collect();
  const rows = await Promise.all(entrants.map(e => ctx.db.get(e.attendeeId)));
  return rows.flatMap(row => (row && row.eventId === secretSanta.eventId && row.status !== 'revoked' ? [row] : []));
}

// Draws names: entrants who are going become the participants and keep-apart
// rules become exclusions both ways. A Secret draw then sends the names. A
// Reviewed draw waits for a host; with `notifyHosts` (a draw nobody was
// watching happen) every host gets an email and a home-screen notice.
// Returns why it couldn't draw, writing nothing in that case.
async function draw(
  ctx: MutationCtx,
  secretSanta: Doc<'secretSantas'>,
  { notifyHosts }: { notifyHosts: boolean },
): Promise<string | null> {
  const going = (await getEntrantRows(ctx, secretSanta)).flatMap(row =>
    row.status === 'going' && row.userId ? [{ attendeeId: row._id, userId: row.userId }] : [],
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
    status: 'drawn',
    drawnAt: Date.now(),
    scheduledDrawId: undefined,
    drawError: undefined,
    undoneAt: undefined,
  });

  if ((secretSanta.mode ?? 'secret') === 'secret') {
    await sendNames(ctx, secretSanta);
  } else if (notifyHosts) {
    const hostUserIds = (
      await ctx.db
        .query('eventAttendees')
        .withIndex('by_event', q => q.eq('eventId', secretSanta.eventId))
        .collect()
    ).flatMap(row => (row.userId && isHostRole(row.role) ? [row.userId] : []));
    await addSecretSantaDrawnNotices(ctx, secretSanta.eventId, hostUserIds);
    await ctx.scheduler.runAfter(0, internal.sendSecretSantaDrawnEmail.sendSecretSantaDrawnEmails, {
      secretSantaId: secretSanta._id,
    });
  }
  return null;
}

// Feeds the email telling hosts a Reviewed draw is waiting to be sent.
export const getDrawnEmailData = internalQuery({
  args: { secretSantaId: v.id('secretSantas') },
  handler: async (ctx, args) => {
    const secretSanta = await ctx.db.get(args.secretSantaId);
    if (!secretSanta || secretSanta.status !== 'drawn') return null;
    const event = await ctx.db.get(secretSanta.eventId);
    if (!event) return null;

    const rows = await ctx.db
      .query('eventAttendees')
      .withIndex('by_event', q => q.eq('eventId', event._id))
      .collect();
    const hosts = await Promise.all(
      rows.map(async row => {
        if (!row.userId || !isHostRole(row.role)) return null;
        const host = await authComponent.getAnyUserById(ctx, row.userId);
        return host ? { toEmail: host.email.toLowerCase(), toName: host.name ?? 'there' } : null;
      }),
    );
    return { eventId: event._id, eventName: event.name, hosts: hosts.filter(h => h !== null) };
  },
});

// For a round set to draw early: draws once nobody in it is still to reply.
// Called whenever an event's guest list changes (an invite answered,
// revoked or removed). Never throws - a failed draw is saved on the round
// for hosts to see, and the scheduled draw still tries again later.
// `notifyHosts` is off when the host is the one who just saved the round.
export async function drawIfEveryoneReplied(ctx: MutationCtx, eventId: Id<'events'>, { notifyHosts = true } = {}) {
  const secretSanta = await getSecretSanta(ctx, eventId);
  if (!secretSanta || secretSanta.status !== 'draft' || !secretSanta.drawEarly) return;

  const rows = await getEntrantRows(ctx, secretSanta);
  if (rows.some(row => row.status === 'invited')) return;

  const error = await draw(ctx, secretSanta, { notifyHosts });
  if (error) await ctx.db.patch(secretSanta._id, { drawError: error });
}

export const drawScheduled = internalMutation({
  args: { secretSantaId: v.id('secretSantas') },
  handler: async (ctx, args) => {
    const secretSanta = await ctx.db.get(args.secretSantaId);
    if (!secretSanta || secretSanta.status !== 'draft') return null;
    const error = await draw(ctx, secretSanta, { notifyHosts: true });
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
      return memberUser
        ? { userId: member.userId, email: memberUser.email.toLowerCase(), name: memberUser.name }
        : null;
    }),
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

    const rows = (
      await ctx.db
        .query('eventAttendees')
        .withIndex('by_event', q => q.eq('eventId', args.eventId))
        .collect()
    ).filter(row => row.status !== 'revoked');

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
        }),
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
      }),
    );
    const attendeeIdByUser = new Map(people.flatMap(p => (p.userId ? [[p.userId, p.attendeeId] as const] : [])));

    const suggestedRules: {
      attendeeAId: Id<'eventAttendees'>;
      attendeeBId: Id<'eventAttendees'>;
      groupId: Id<'groups'>;
    }[] = [];
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

    // A round that hasn't been drawn yet (e.g. after an undo) pre-fills the form.
    const secretSanta = await getSecretSanta(ctx, args.eventId);
    let saved = null;
    if (secretSanta?.status === 'draft') {
      const [entrants, rules] = await Promise.all([
        ctx.db
          .query('secretSantaEntrants')
          .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
          .collect(),
        ctx.db
          .query('secretSantaRules')
          .withIndex('by_secretSanta', q => q.eq('secretSantaId', secretSanta._id))
          .collect(),
      ]);
      saved = {
        attendeeIds: entrants.map(e => e.attendeeId),
        rules: rules.map(r => ({ attendeeAId: r.attendeeAId, attendeeBId: r.attendeeBId })),
        mode: secretSanta.mode ?? 'secret',
        budget: secretSanta.budget ?? null,
        drawAt: secretSanta.drawAt ?? null,
        drawEarly: !!secretSanta.drawEarly,
      };
    }

    return {
      people,
      saved,
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
  rowB: Doc<'eventAttendees'>,
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
// past), names are drawn now - only people going are in. In a Reviewed draw
// nobody is told until a host sends the names. Otherwise the draw
// is scheduled, and with `drawEarly` happens as soon as everyone picked has
// replied. A round that hasn't been drawn yet (scheduled, or undone) is
// replaced; one that has been drawn must be undone first.
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
      }),
    ),
    mode: v.union(v.literal('secret'), v.literal('reviewed')),
    drawAt: v.optional(v.number()),
    drawEarly: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireHost(ctx, args.eventId, user._id);

    const existing = await getSecretSanta(ctx, args.eventId);
    if (existing && existing.status !== 'draft') {
      throw new ConvexError('Names have already been drawn. Undo the draw to change it.');
    }

    const attendeeIds = [...new Set(args.attendeeIds)];
    const rows = new Map<string, Doc<'eventAttendees'>>();
    for (const id of attendeeIds) {
      const row = await ctx.db.get(id);
      if (!row || row.eventId !== args.eventId || row.status === 'revoked')
        throw new ConvexError('Someone in the draw is no longer on the event.');
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
    const fields = {
      mode: args.mode,
      budget: args.budget,
      drawAt: drawLater ? args.drawAt : undefined,
      drawEarly: drawLater ? args.drawEarly : undefined,
    };
    let secretSantaId: Id<'secretSantas'>;
    if (existing) {
      secretSantaId = existing._id;
      await cancelScheduledDraw(ctx, existing);
      await deleteSecretSantaChildren(ctx, secretSantaId);
      await deleteEntrantsAndRules(ctx, secretSantaId);
      await ctx.db.patch(secretSantaId, {
        ...fields,
        scheduledDrawId: undefined,
        drawError: undefined,
        undoneAt: undefined,
      });
    } else {
      secretSantaId = await ctx.db.insert('secretSantas', {
        eventId: args.eventId,
        status: 'draft',
        createdBy: user._id,
        ...fields,
      });
    }

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
      const error = await draw(ctx, (await ctx.db.get(secretSantaId))!, { notifyHosts: false });
      // Throwing rolls back the whole setup, so the host can fix it and retry.
      if (error) throw new ConvexError(error);
      return secretSantaId;
    }

    const scheduledDrawId = await ctx.scheduler.runAt(args.drawAt!, internal.secretSanta.drawScheduled, {
      secretSantaId,
    });
    await ctx.db.patch(secretSantaId, { scheduledDrawId });
    // Everyone may already have replied.
    await drawIfEveryoneReplied(ctx, args.eventId, { notifyHosts: false });
    return secretSantaId;
  },
});
