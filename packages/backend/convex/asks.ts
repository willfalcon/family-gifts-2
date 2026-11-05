import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { areConnected } from './connections';
import { getAttendance } from './events';
import { visibleBirthday } from './giftShopping';
import { addDays, nextYearly, normalizeToday } from './occasions';
import { colorFor } from './people';
import { getFirstName } from './profiles';
import { askOccasionValidator, type AskOccasion } from './schema';
import { addMessage, cleanBody, createSantaThread, getOrCreatePairThread } from './threads';

// Asks: requests to one person for gift ideas for an occasion. See Ask in
// GLOSSARY.md and .scratch/ask-for-ideas/spec.md.

// An Ask stays open this long after its occasion, for late gifts.
const GRACE_DAYS = 7;

// Names an occasion so an Ask can be matched with a list for it. Null for
// list occasions you can't ask about (another date).
export function occasionKey(occasion: Doc<'lists'>['occasion'] | AskOccasion | undefined): string | null {
  if (!occasion) return 'none';
  if (occasion.kind === 'event') return `event:${occasion.eventId}`;
  if (occasion.kind === 'date') return null;
  return occasion.kind;
}

export type AskInfo = {
  open: boolean;
  // Groups Asks for the same occasion. Christmas and birthdays include which
  // year's, so next year's Ask isn't this year's.
  groupKey: string;
  kind: 'event' | 'christmas' | 'birthday' | 'none';
  // e.g. "Christmas party", "Christmas", "Mom's birthday", "Your birthday".
  // Null when there's no occasion.
  label: string | null;
  // The same, for the middle of a sentence ("...made a list for your birthday").
  phrase: string | null;
  date: string | null;
  eventId: Id<'events'> | null;
};

// What an Ask is for, as `viewerId` should see it, and whether it's still
// open on `today`.
export async function describeAsk(ctx: QueryCtx, ask: Doc<'asks'>, today: string, viewerId: string): Promise<AskInfo> {
  const answered = ask.answeredAt !== undefined;
  const occasion = ask.occasion;
  if (!occasion) {
    return { open: !answered, groupKey: 'none', kind: 'none', label: null, phrase: null, date: null, eventId: null };
  }
  if (occasion.kind === 'event') {
    const event = await ctx.db.get(occasion.eventId);
    const groupKey = `event:${occasion.eventId}`;
    if (!event) {
      return { open: false, groupKey, kind: 'event', label: 'An event', phrase: 'an event', date: null, eventId: null };
    }
    const lastDay = event.endDate ?? event.date;
    const inTime = !lastDay || today <= addDays(lastDay, GRACE_DAYS);
    // A Secret Santa Ask also closes once its draw is undone.
    const drawStands = !ask.secretSanta || (await santaThreadStands(ctx, ask.threadId));
    return {
      open: !answered && event.cancelledAt === undefined && inTime && drawStands,
      groupKey,
      kind: 'event',
      label: event.name,
      phrase: event.name,
      date: event.date ?? null,
      eventId: event._id,
    };
  }
  const date = ask.occurrenceDate ?? null;
  const open = !answered && (date === null || today <= addDays(date, GRACE_DAYS));
  const groupKey = `${occasion.kind}:${date}`;
  if (occasion.kind === 'christmas') {
    return { open, groupKey, kind: 'christmas', label: 'Christmas', phrase: 'Christmas', date, eventId: null };
  }
  let label = 'Your birthday';
  let phrase = 'your birthday';
  if (viewerId !== ask.askedId) {
    const asked = await authComponent.getAnyUserById(ctx, ask.askedId);
    const firstName = asked ? await getFirstName(ctx, ask.askedId, asked.name) : 'Their';
    label = phrase = `${firstName}’s birthday`;
  }
  return { open, groupKey, kind: 'birthday', label, phrase, date, eventId: null };
}

// Whether a Secret Santa Ask's Thread still belongs to a live Match: the
// draw hasn't been undone since it was sent.
export async function santaThreadStands(ctx: QueryCtx, threadId: Id<'threads'>) {
  const thread = await ctx.db.get(threadId);
  return !!thread?.assignmentId && (await ctx.db.get(thread.assignmentId)) !== null;
}

function serverToday() {
  return new Date().toISOString().slice(0, 10);
}

// Closes the owner's open Asks that `list` answers: it's for their occasion
// and has at least one item. Each gets a "made a list" line in its Thread.
// Call after anything that could make that true.
export async function answerAsks(ctx: MutationCtx, list: Doc<'lists'>) {
  if (list.archivedAt !== undefined || list.itemCount < 1) return;
  const key = occasionKey(list.occasion);
  if (key === null) return;
  const today = serverToday();
  const asks = await ctx.db
    .query('asks')
    .withIndex('by_askedId_and_answeredAt', q => q.eq('askedId', list.createdBy).eq('answeredAt', undefined))
    .take(100);
  for (const ask of asks) {
    if (occasionKey(ask.occasion) !== key) continue;
    if (!(await describeAsk(ctx, ask, today, list.createdBy)).open) continue;
    await ctx.db.patch(ask._id, { answeredAt: Date.now() });
    await addMessage(ctx, ask.threadId, list.createdBy, { kind: 'listMade', askId: ask._id });
  }
}

type Option = {
  key: string;
  occasion: AskOccasion | null;
  label: string;
  phrase: string | null;
  date: string | null;
  // Others with an open Ask to this person for it. Names only, never what
  // they wrote.
  otherAskers: { name: string; askedAt: number }[];
  // When you asked, if your own Ask for it is still open.
  myAskedAt: number | null;
};

// What the Ask for ideas sheet needs: who you're asking, what you can ask
// about, and who's already asked. `eventId` fixes the occasion to that event
// (asking from the event page). `userId` and `eventId` come from the client,
// so they're taken as strings and checked.
export const compose = query({
  args: { userId: v.string(), eventId: v.optional(v.string()), today: v.string() },
  handler: async (ctx, args) => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    if (!viewer || viewer._id === args.userId) return null;
    const target = await authComponent.getAnyUserById(ctx, args.userId);
    if (!target) return null;
    const today = normalizeToday(args.today);
    const firstName = await getFirstName(ctx, args.userId, target.name);

    const options: Omit<Option, 'otherAskers' | 'myAskedAt'>[] = [];
    const eventOption = (event: Doc<'events'>) => ({
      key: `event:${event._id}`,
      occasion: { kind: 'event' as const, eventId: event._id },
      label: event.name,
      phrase: event.name,
      date: event.date ?? null,
    });

    if (args.eventId !== undefined) {
      const eventId = ctx.db.normalizeId('events', args.eventId);
      const event = eventId && (await ctx.db.get(eventId));
      if (event && (await canAskAboutEvent(ctx, event, viewer._id, args.userId))) options.push(eventOption(event));
    } else {
      // Upcoming events you're both on.
      for await (const attendance of ctx.db
        .query('eventAttendees')
        .withIndex('by_user', q => q.eq('userId', viewer._id))) {
        const event = await ctx.db.get(attendance.eventId);
        if (!event?.date || (event.endDate ?? event.date) < today) continue;
        if (await canAskAboutEvent(ctx, event, viewer._id, args.userId)) options.push(eventOption(event));
      }
      options.push({
        key: `christmas:${nextYearly(12, 25, today)}`,
        occasion: { kind: 'christmas' },
        label: 'Christmas',
        phrase: 'Christmas',
        date: nextYearly(12, 25, today),
      });
      const birthday = await visibleBirthday(ctx, args.userId, viewer._id);
      if (birthday) {
        const date = nextYearly(birthday.month, birthday.day, today);
        options.push({
          key: `birthday:${date}`,
          occasion: { kind: 'birthday' },
          label: `${firstName}’s birthday`,
          phrase: `your birthday`,
          date,
        });
      }
      options.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
      options.push({ key: 'none', occasion: null, label: 'No occasion', phrase: null, date: null });
    }

    // Open Asks to this person, by occasion.
    const asked = new Map<string, Option['otherAskers']>();
    const mine = new Map<string, number>();
    const asks = await ctx.db
      .query('asks')
      .withIndex('by_askedId_and_answeredAt', q => q.eq('askedId', args.userId).eq('answeredAt', undefined))
      .take(100);
    for (const ask of asks) {
      // Nobody else knows about a Secret Santa Ask, and it isn't this one.
      if (ask.secretSanta) continue;
      const info = await describeAsk(ctx, ask, today, viewer._id);
      if (!info.open) continue;
      if (ask.askerId === viewer._id) {
        mine.set(info.groupKey, ask._creationTime);
        continue;
      }
      const asker = await authComponent.getAnyUserById(ctx, ask.askerId);
      if (!asker) continue;
      const list = asked.get(info.groupKey) ?? [];
      list.push({ name: await getFirstName(ctx, ask.askerId, asker.name), askedAt: ask._creationTime });
      asked.set(info.groupKey, list);
    }

    return {
      userId: args.userId,
      name: target.name,
      firstName,
      image: target.image ?? null,
      color: colorFor(args.userId),
      canAsk: await areConnected(ctx, viewer._id, args.userId),
      options: options.map(option => ({
        ...option,
        otherAskers: asked.get(option.key) ?? [],
        myAskedAt: mine.get(option.key) ?? null,
      })),
    };
  },
});

// You can ask about an event you're on, not cancelled, that they've replied
// to (going or not).
async function canAskAboutEvent(ctx: QueryCtx, event: Doc<'events'>, askerId: string, askedId: string) {
  if (event.cancelledAt !== undefined) return false;
  if (!(await getAttendance(ctx, event._id, askerId))) return false;
  const theirs = await getAttendance(ctx, event._id, askedId);
  return theirs?.status === 'going' || theirs?.status === 'declined';
}

// Sends an Ask. If you already have one open to them for this occasion, the
// message is added to it instead. Returns the Thread it went to.
export const send = mutation({
  args: {
    askedId: v.string(),
    occasion: v.optional(askOccasionValidator),
    body: v.string(),
    today: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const body = cleanBody(args.body);
    const today = normalizeToday(args.today);
    if (args.askedId === user._id) throw new ConvexError('You can’t ask yourself.');
    if (!(await authComponent.getAnyUserById(ctx, args.askedId))) throw new ConvexError('Person not found.');
    if (!(await areConnected(ctx, user._id, args.askedId))) {
      throw new ConvexError('You can only ask people you share a group or event with.');
    }

    let occurrenceDate: string | undefined;
    const occasion = args.occasion;
    if (occasion?.kind === 'event') {
      const event = await ctx.db.get(occasion.eventId);
      if (!event || !(await canAskAboutEvent(ctx, event, user._id, args.askedId))) {
        throw new ConvexError('You can’t ask about that event.');
      }
    } else if (occasion?.kind === 'christmas') {
      occurrenceDate = nextYearly(12, 25, today);
    } else if (occasion?.kind === 'birthday') {
      const birthday = await visibleBirthday(ctx, args.askedId, user._id);
      if (!birthday) throw new ConvexError('You can’t see their birthday.');
      occurrenceDate = nextYearly(birthday.month, birthday.day, today);
    }

    const threadId = await getOrCreatePairThread(ctx, user._id, args.askedId);

    // One Ask per asker, per person, per occasion.
    const key = occasionKey(occasion);
    for await (const ask of ctx.db
      .query('asks')
      .withIndex('by_askerId_and_askedId', q => q.eq('askerId', user._id).eq('askedId', args.askedId))) {
      if (ask.secretSanta || ask.answeredAt !== undefined || occasionKey(ask.occasion) !== key) continue;
      if (ask.occurrenceDate !== occurrenceDate) continue;
      if (!(await describeAsk(ctx, ask, today, user._id)).open) continue;
      await addMessage(ctx, ask.threadId, user._id, { kind: 'text', body });
      return ask.threadId;
    }

    const askId = await ctx.db.insert('asks', {
      threadId,
      askerId: user._id,
      askedId: args.askedId,
      occasion,
      occurrenceDate,
    });
    await addMessage(ctx, threadId, user._id, { kind: 'ask', body, askId });
    return threadId;
  },
});

// Your Match in an event's Secret Santa, once the names are sent.
async function getMyMatch(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  const secretSanta = await ctx.db
    .query('secretSantas')
    .withIndex('by_event', q => q.eq('eventId', eventId))
    .unique();
  if (!secretSanta || secretSanta.status !== 'sent') return null;
  return await ctx.db
    .query('secretSantaAssignments')
    .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', userId))
    .unique();
}

// Whether someone has a list for an event with at least one item on it,
// which answers any Ask for it.
async function hasListForEvent(ctx: QueryCtx, eventId: Id<'events'>, userId: string) {
  const lists = await ctx.db
    .query('lists')
    .withIndex('by_occasion_event', q => q.eq('occasion.eventId', eventId))
    .take(500);
  return lists.some(l => l.createdBy === userId && l.archivedAt === undefined && l.itemCount > 0);
}

async function getSantaThread(ctx: QueryCtx, assignmentId: Id<'secretSantaAssignments'>) {
  return await ctx.db
    .query('threads')
    .withIndex('by_assignmentId', q => q.eq('assignmentId', assignmentId))
    .unique();
}

// Your open Secret Santa Ask in a Thread, if there is one.
async function getOpenSantaAsk(
  ctx: QueryCtx,
  threadId: Id<'threads'>,
  askerId: string,
  askedId: string,
  today: string,
) {
  for await (const ask of ctx.db
    .query('asks')
    .withIndex('by_askerId_and_askedId', q => q.eq('askerId', askerId).eq('askedId', askedId))) {
    if (ask.threadId !== threadId || ask.answeredAt !== undefined) continue;
    if ((await describeAsk(ctx, ask, today, askerId)).open) return ask;
  }
  return null;
}

// For the Secret Santa page and gift shopping: whether you can send your Match
// a Secret Santa Ask, and the Thread if you already have. Null if you have no
// Match for this event. See .scratch/secret-santa-ask/spec.md.
export const secretSanta = query({
  args: { eventId: v.id('events'), today: v.string() },
  handler: async (ctx, args) => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    if (!viewer) return null;
    const assignment = await getMyMatch(ctx, args.eventId, viewer._id);
    if (!assignment) return null;
    const matchId = assignment.receiverUserId;
    const match = await authComponent.getAnyUserById(ctx, matchId);
    if (!match) return null;
    const event = await ctx.db.get(args.eventId);
    const thread = await getSantaThread(ctx, assignment._id);
    const openAsk = thread && (await getOpenSantaAsk(ctx, thread._id, viewer._id, matchId, normalizeToday(args.today)));
    return {
      name: match.name,
      firstName: await getFirstName(ctx, matchId, match.name),
      color: colorFor(matchId),
      threadId: thread?._id ?? null,
      canAsk: !!event && event.cancelledAt === undefined && !(await hasListForEvent(ctx, args.eventId, matchId)),
      myAskedAt: openAsk?._creationTime ?? null,
    };
  },
});

// Sends your Match a Secret Santa Ask for the event, in a Thread of its own
// that never names you to them. If one's already open, the message is added
// to it. Returns the Thread.
export const sendSecretSanta = mutation({
  args: { eventId: v.id('events'), body: v.string(), today: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const body = cleanBody(args.body);
    const today = normalizeToday(args.today);
    const assignment = await getMyMatch(ctx, args.eventId, user._id);
    if (!assignment) throw new ConvexError('You don’t have a Secret Santa match for this event.');
    const event = await ctx.db.get(args.eventId);
    if (!event || event.cancelledAt !== undefined) throw new ConvexError('This event was cancelled.');
    const matchId = assignment.receiverUserId;

    let thread = await getSantaThread(ctx, assignment._id);
    if (thread) {
      const open = await getOpenSantaAsk(ctx, thread._id, user._id, matchId, today);
      if (open) {
        await addMessage(ctx, thread._id, user._id, { kind: 'text', body });
        return thread._id;
      }
    }
    if (await hasListForEvent(ctx, args.eventId, matchId)) {
      throw new ConvexError('They already have a list for this event.');
    }
    const threadId = thread?._id ?? (await createSantaThread(ctx, assignment));
    const askId = await ctx.db.insert('asks', {
      threadId,
      askerId: user._id,
      askedId: matchId,
      secretSanta: true,
      occasion: { kind: 'event', eventId: args.eventId },
    });
    await addMessage(ctx, threadId, user._id, { kind: 'ask', body, askId });
    return threadId;
  },
});
