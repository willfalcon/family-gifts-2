import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { describeAsk, santaThreadStands, type AskInfo } from './asks';
import { areConnected } from './connections';
import { normalizeToday } from './occasions';
import { colorFor } from './people';
import { getFirstName } from './profiles';

// Threads: conversations between people. See Thread in GLOSSARY.md and
// .scratch/ask-for-ideas/spec.md.

const MAX_MESSAGE_LENGTH = 2000;
// How many messages a Thread shows, newest last.
const MESSAGES_SHOWN = 200;

// A message's text, trimmed. Throws if it's empty or too long.
export function cleanBody(body: string) {
  const text = body.trim();
  if (!text) throw new ConvexError('Write a message first.');
  if (text.length > MAX_MESSAGE_LENGTH) throw new ConvexError('That message is too long.');
  return text;
}

// The 1:1 Thread between two people, made if it doesn't exist yet.
export async function getOrCreatePairThread(ctx: MutationCtx, userId: string, otherId: string) {
  const pairKey = [userId, otherId].sort().join('|');
  const existing = await ctx.db
    .query('threads')
    .withIndex('by_pairKey', q => q.eq('pairKey', pairKey))
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  const threadId = await ctx.db.insert('threads', { pairKey, lastMessageAt: now });
  for (const id of [userId, otherId]) {
    await ctx.db.insert('threadMembers', { threadId, userId: id, lastMessageAt: now, unreadCount: 0 });
  }
  return threadId;
}

// The Thread for a Secret Santa Ask: the giver and their Match, tied to the
// draw's assignment so it can tell when that draw is undone.
export async function createSantaThread(ctx: MutationCtx, assignment: Doc<'secretSantaAssignments'>) {
  const now = Date.now();
  const threadId = await ctx.db.insert('threads', {
    lastMessageAt: now,
    assignmentId: assignment._id,
    santaId: assignment.giverUserId,
  });
  for (const id of [assignment.giverUserId, assignment.receiverUserId]) {
    await ctx.db.insert('threadMembers', { threadId, userId: id, lastMessageAt: now, unreadCount: 0 });
  }
  return threadId;
}

// Adds a message to a Thread. It's unread for everyone but its author, and
// writing one counts as having read the Thread.
export async function addMessage(
  ctx: MutationCtx,
  threadId: Id<'threads'>,
  authorId: string,
  message: { kind: Doc<'messages'>['kind']; body?: string; askId?: Id<'asks'> },
) {
  await ctx.db.insert('messages', { threadId, authorId, ...message });
  const now = Date.now();
  await ctx.db.patch(threadId, { lastMessageAt: now });
  for (const member of await getMembers(ctx, threadId)) {
    await ctx.db.patch(member._id, {
      lastMessageAt: now,
      unreadCount: member.userId === authorId ? 0 : member.unreadCount + 1,
    });
  }
}

async function getMembers(ctx: QueryCtx, threadId: Id<'threads'>) {
  return await ctx.db
    .query('threadMembers')
    .withIndex('by_threadId_and_userId', q => q.eq('threadId', threadId))
    .take(50);
}

async function getMembership(ctx: QueryCtx, threadId: Id<'threads'>, userId: string) {
  return await ctx.db
    .query('threadMembers')
    .withIndex('by_threadId_and_userId', q => q.eq('threadId', threadId).eq('userId', userId))
    .unique();
}

// Stands in for the giver everywhere their Match sees a Secret Santa Thread.
// Nothing about the giver, not even their id or colour, goes to the Match.
const SANTA_ID = 'secret-santa';
const SANTA = {
  userId: SANTA_ID,
  name: 'Your Secret Santa',
  firstName: 'Your Secret Santa',
  image: null,
  color: colorFor(SANTA_ID),
  secretSanta: true,
};

async function person(ctx: QueryCtx, userId: string) {
  const user = await authComponent.getAnyUserById(ctx, userId);
  const name = user?.name ?? 'Someone';
  return {
    userId,
    name,
    firstName: user ? await getFirstName(ctx, userId, user.name) : name,
    image: user?.image ?? null,
    color: colorFor(userId),
    secretSanta: false,
  };
}

// Someone in `thread` as `viewerId` should see them.
function hides(thread: Doc<'threads'> | null, userId: string, viewerId: string) {
  return !!thread?.santaId && thread.santaId === userId && viewerId !== userId;
}

async function member(ctx: QueryCtx, thread: Doc<'threads'> | null, userId: string, viewerId: string) {
  return hides(thread, userId, viewerId) ? SANTA : await person(ctx, userId);
}

// Who you are in a Secret Santa Thread: giving (you sent the Ask) or the
// Match. Null for other Threads.
function santaRole(thread: Doc<'threads'> | null, viewerId: string) {
  if (!thread?.santaId) return null;
  return thread.santaId === viewerId ? ('giver' as const) : ('match' as const);
}

// Caches Ask lookups while building one response.
function askReader(ctx: QueryCtx, today: string, viewerId: string) {
  const cache = new Map<Id<'asks'>, Promise<(AskInfo & { ask: Doc<'asks'> }) | null>>();
  return (askId: Id<'asks'>) => {
    let found = cache.get(askId);
    if (!found) {
      found = (async () => {
        const ask = await ctx.db.get(askId);
        return ask && { ask, ...(await describeAsk(ctx, ask, today, viewerId)) };
      })();
      cache.set(askId, found);
    }
    return found;
  };
}

// A message as one line of text, for previews.
async function previewText(
  ctx: QueryCtx,
  thread: Doc<'threads'> | null,
  message: Doc<'messages'>,
  readAsk: ReturnType<typeof askReader>,
  viewerId: string,
) {
  if (message.kind !== 'listMade') return message.body ?? '';
  const info = message.askId ? await readAsk(message.askId) : null;
  const who = message.authorId === viewerId ? 'You' : (await member(ctx, thread, message.authorId, viewerId)).firstName;
  return info?.phrase ? `${who} made a list for ${info.phrase}` : `${who} made a list`;
}

// One row in a list of Threads.
async function summarize(
  ctx: QueryCtx,
  membership: Doc<'threadMembers'>,
  viewerId: string,
  readAsk: ReturnType<typeof askReader>,
) {
  const thread = await ctx.db.get(membership.threadId);
  const members = await getMembers(ctx, membership.threadId);
  const others = await Promise.all(
    members.filter(m => m.userId !== viewerId).map(m => member(ctx, thread, m.userId, viewerId)),
  );
  const last = await ctx.db
    .query('messages')
    .withIndex('by_threadId', q => q.eq('threadId', membership.threadId))
    .order('desc')
    .first();
  return {
    _id: membership.threadId,
    others,
    secretSanta: santaRole(thread, viewerId),
    unreadCount: membership.unreadCount,
    lastMessageAt: membership.lastMessageAt,
    lastMessage: last && {
      text: await previewText(ctx, thread, last, readAsk, viewerId),
      mine: last.authorId === viewerId,
    },
  };
}

export type ThreadSummary = Awaited<ReturnType<typeof summarize>>;

// The home screen's Threads section:
// - `askGroups`: open Asks to you, one group per occasion, soonest first.
// - `santaAsks`: open Secret Santa Asks to you, kept apart from the rest.
// - `threads`: other Threads with unread messages, newest first.
// - `hasThreads`: whether you're in any Thread at all.
export const home = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    if (!viewer) return null;
    const today = normalizeToday(args.today);
    const readAsk = askReader(ctx, today, viewer._id);
    const summaries = new Map<Id<'threads'>, Promise<ThreadSummary | null>>();
    const summary = (threadId: Id<'threads'>) => {
      let found = summaries.get(threadId);
      if (!found) {
        found = getMembership(ctx, threadId, viewer._id).then(m => m && summarize(ctx, m, viewer._id, readAsk));
        summaries.set(threadId, found);
      }
      return found;
    };

    type Group = {
      key: string;
      info: AskInfo;
      askers: string[];
      threadIds: Id<'threads'>[];
    };
    const groups = new Map<string, Group>();
    const santaAsks: { key: string; label: string | null; threadId: Id<'threads'> }[] = [];
    const asks = await ctx.db
      .query('asks')
      .withIndex('by_askedId_and_answeredAt', q => q.eq('askedId', viewer._id).eq('answeredAt', undefined))
      .take(100);
    for (const ask of asks) {
      const info = await readAsk(ask._id);
      if (!info?.open) continue;
      if (ask.secretSanta) {
        santaAsks.push({ key: ask._id, label: info.label, threadId: ask.threadId });
        continue;
      }
      const group = groups.get(info.groupKey) ?? { key: info.groupKey, info, askers: [], threadIds: [] };
      group.askers.push((await person(ctx, ask.askerId)).firstName);
      if (!group.threadIds.includes(ask.threadId)) group.threadIds.push(ask.threadId);
      groups.set(info.groupKey, group);
    }

    const inGroups = new Set([...groups.values()].flatMap(g => g.threadIds).concat(santaAsks.map(a => a.threadId)));
    const askGroups = await Promise.all(
      [...groups.values()]
        .sort((a, b) => (a.info.date ?? '9999').localeCompare(b.info.date ?? '9999'))
        .map(async group => ({
          key: group.key,
          kind: group.info.kind,
          label: group.info.label,
          date: group.info.date,
          eventId: group.info.eventId,
          askers: group.askers,
          threads: (await Promise.all(group.threadIds.map(summary)))
            .filter(t => t !== null)
            .sort((a, b) => b.lastMessageAt - a.lastMessageAt),
        })),
    );

    const santaCards = (
      await Promise.all(
        santaAsks.map(async ask => {
          const thread = await summary(ask.threadId);
          return thread && { key: ask.key, label: ask.label, thread };
        }),
      )
    ).filter(card => card !== null);

    const threads = [];
    let hasThreads = false;
    for await (const membership of ctx.db
      .query('threadMembers')
      .withIndex('by_userId_and_lastMessageAt', q => q.eq('userId', viewer._id))
      .order('desc')) {
      hasThreads = true;
      if (threads.length >= 20) break;
      if (membership.unreadCount === 0 || inGroups.has(membership.threadId)) continue;
      const found = await summary(membership.threadId);
      if (found) threads.push(found);
    }

    // Whether you have any Threads at all, so the home screen can link to them.
    return { askGroups, santaAsks: santaCards, threads, hasThreads };
  },
});

// Every Thread you're in, newest first.
export const mine = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    if (!viewer) return [];
    const readAsk = askReader(ctx, normalizeToday(args.today), viewer._id);
    const memberships = await ctx.db
      .query('threadMembers')
      .withIndex('by_userId_and_lastMessageAt', q => q.eq('userId', viewer._id))
      .order('desc')
      .take(100);
    return await Promise.all(memberships.map(m => summarize(ctx, m, viewer._id, readAsk)));
  },
});

// How many unread messages you have, for the Home tab's badge.
export const unreadCount = query({
  args: {},
  handler: async ctx => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    if (!viewer) return 0;
    const memberships = await ctx.db
      .query('threadMembers')
      .withIndex('by_userId_and_lastMessageAt', q => q.eq('userId', viewer._id))
      .order('desc')
      .take(200);
    return memberships.reduce((sum, m) => sum + m.unreadCount, 0);
  },
});

// One Thread with its messages, oldest first. Null if it doesn't exist or
// you're not in it. `id` comes from a URL param, so it's taken as a string.
export const get = query({
  args: { id: v.string(), today: v.string() },
  handler: async (ctx, args) => {
    const viewer = await authComponent.safeGetAuthUser(ctx);
    const threadId = ctx.db.normalizeId('threads', args.id);
    if (!viewer || !threadId) return null;
    const membership = await getMembership(ctx, threadId, viewer._id);
    if (!membership) return null;
    const today = normalizeToday(args.today);
    const readAsk = askReader(ctx, today, viewer._id);

    const thread = await ctx.db.get(threadId);
    const members = await getMembers(ctx, threadId);
    const otherIds = members.filter(m => m.userId !== viewer._id).map(m => m.userId);
    const others = await Promise.all(otherIds.map(id => member(ctx, thread, id, viewer._id)));
    const cantSend = await whyCantSend(ctx, thread, viewer._id, otherIds);

    const newest = await ctx.db
      .query('messages')
      .withIndex('by_threadId', q => q.eq('threadId', threadId))
      .order('desc')
      .take(MESSAGES_SHOWN);
    const messages = await Promise.all(
      newest.reverse().map(async message => {
        const info = message.askId ? await readAsk(message.askId) : null;
        return {
          _id: message._id,
          _creationTime: message._creationTime,
          kind: message.kind,
          authorId: hides(thread, message.authorId, viewer._id) ? SANTA_ID : message.authorId,
          mine: message.authorId === viewer._id,
          text:
            message.kind === 'listMade'
              ? await previewText(ctx, thread, message, readAsk, viewer._id)
              : (message.body ?? ''),
          // What the Ask was for, on the message that sent it.
          askLabel: message.kind === 'ask' ? (info?.label ?? 'No occasion') : null,
        };
      }),
    );

    // Open Asks to you here, so you can make the list they're asking for.
    const openAsks: { groupKey: string; kind: AskInfo['kind']; label: string | null; eventId: Id<'events'> | null }[] =
      [];
    for (const ask of await ctx.db
      .query('asks')
      .withIndex('by_askedId_and_answeredAt', q => q.eq('askedId', viewer._id).eq('answeredAt', undefined))
      .take(100)) {
      if (ask.threadId !== threadId) continue;
      const info = await readAsk(ask._id);
      if (info?.open && !openAsks.some(a => a.groupKey === info.groupKey)) {
        openAsks.push({ groupKey: info.groupKey, kind: info.kind, label: info.label, eventId: info.eventId });
      }
    }

    return {
      _id: threadId,
      me: await person(ctx, viewer._id),
      others,
      secretSanta: santaRole(thread, viewer._id),
      canSend: cantSend === null,
      // Why you can't send, when you can't.
      cantSend,
      messages,
      openAsks,
    };
  },
});

// Marks a Thread read for you.
export const markRead = mutation({
  args: { id: v.id('threads') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const membership = await getMembership(ctx, args.id, user._id);
    if (membership && membership.unreadCount > 0) await ctx.db.patch(membership._id, { unreadCount: 0 });
  },
});

export const send = mutation({
  args: { id: v.id('threads'), body: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const body = cleanBody(args.body);
    if (!(await getMembership(ctx, args.id, user._id))) throw new ConvexError('Thread not found.');
    const otherIds = (await getMembers(ctx, args.id)).map(m => m.userId).filter(id => id !== user._id);
    const cantSend = await whyCantSend(ctx, await ctx.db.get(args.id), user._id, otherIds);
    if (cantSend) throw new ConvexError(cantSend);
    await addMessage(ctx, args.id, user._id, { kind: 'text', body });
  },
});

// Why `viewerId` can't send in a Thread, or null if they can. Only
// Connections can message each other, and a Secret Santa Thread closes once
// its draw is undone.
async function whyCantSend(ctx: QueryCtx, thread: Doc<'threads'> | null, viewerId: string, otherIds: string[]) {
  if (!thread || otherIds.length === 0) return 'Nobody else is here.';
  if (thread.santaId && !(await santaThreadStands(ctx, thread._id))) {
    return 'This Secret Santa was drawn again, so you can’t send messages here.';
  }
  for (const id of otherIds) {
    if (!(await areConnected(ctx, viewerId, id))) {
      return 'You no longer share a group or event, so you can’t send messages here.';
    }
  }
  return null;
}
