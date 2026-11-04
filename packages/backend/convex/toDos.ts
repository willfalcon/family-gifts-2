import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { isHostRole } from './events';
import { daysBetween, nextYearly, normalizeToday } from './occasions';

// To-dos: what the app suggests you do next, shown on the home screen. They
// aren't stored. Each is worked out from everything else and goes away once
// it's no longer true, or once you dismiss it. See GLOSSARY.md and
// .scratch/to-dos/spec.md.

// How far ahead an occasion counts as coming up.
const WINDOW_DAYS = 28;
// December events (other than birthdays) and Christmas lists start earlier.
const CHRISTMAS_WINDOW_DAYS = 56;
// "Get your Secret Santa gift" only shows this close to the event.
const MATCH_GIFT_WINDOW_DAYS = 14;
// A list with fewer items than this gets "Add a few ideas".
const FEW_ITEMS = 3;
// Fewer people than this and a Secret Santa doesn't make sense.
const SECRET_SANTA_MIN_PEOPLE = 3;

export type ToDoKind = 'makeList' | 'addIdeas' | 'setUpSecretSanta' | 'sendNames' | 'matchGift';

type ToDo = {
  // Names this to-do for this occurrence. Dismissing stores it.
  key: string;
  kind: ToDoKind;
  // What it's for: an event's name, "Christmas", "Your birthday", or a list's title.
  label: string;
  occasion: 'event' | 'christmas' | 'birthday' | 'date';
  // When the occasion is. Null only for Send the names on an undated event.
  date: string | null;
  eventId: Id<'events'> | null;
  listId: Id<'lists'> | null;
  itemCount: number | null;
  // Other people are waiting on a host to-do, so it sorts first.
  forHost: boolean;
};

function eventWindow(event: Doc<'events'>, date: string) {
  return !event.sourceBirthday && date.slice(5, 7) === '12' ? CHRISTMAS_WINDOW_DAYS : WINDOW_DAYS;
}

// Whether an occasion running from `date` to `lastDay` is on now or starts
// within `days`.
function comingUp(today: string, date: string, lastDay: string, days: number) {
  return lastDay >= today && daysBetween(today, date) <= days;
}

async function isDismissed(ctx: QueryCtx, userId: string, key: string) {
  const row = await ctx.db
    .query('toDoDismissals')
    .withIndex('by_userId_and_key', q => q.eq('userId', userId).eq('key', key))
    .first();
  return row !== null;
}

async function isShared(ctx: QueryCtx, listId: Id<'lists'>) {
  const share = await ctx.db
    .query('listShares')
    .withIndex('by_list', q => q.eq('listId', listId))
    .first();
  return share !== null;
}

const KIND_RANK: Record<ToDoKind, number> = {
  sendNames: 0,
  setUpSecretSanta: 1,
  matchGift: 2,
  makeList: 3,
  addIdeas: 4,
};

export const mine = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const today = normalizeToday(args.today);
    const toDos: ToDo[] = [];

    const myLists = await ctx.db
      .query('lists')
      .withIndex('by_createdBy_archivedAt', q => q.eq('createdBy', user._id).eq('archivedAt', undefined))
      .collect();

    // Events you're on.
    for await (const attendance of ctx.db.query('eventAttendees').withIndex('by_user', q => q.eq('userId', user._id))) {
      // Archiving an event tucks it away, to-dos included.
      if (attendance.archivedAt !== undefined) continue;
      const event = await ctx.db.get(attendance.eventId);
      if (!event || event.cancelledAt !== undefined) continue;
      const date = event.date ?? null;
      const lastDay = event.endDate ?? date;
      const base = { label: event.name, occasion: 'event' as const, date, eventId: event._id };
      const upcoming = date !== null && lastDay !== null && comingUp(today, date, lastDay, eventWindow(event, date));

      if (attendance.status === 'going' && upcoming) {
        const lists = myLists.filter(l => l.occasion?.kind === 'event' && l.occasion.eventId === event._id);
        if (lists.length === 0) {
          toDos.push({ ...base, key: `makeList:${event._id}`, kind: 'makeList', listId: null, itemCount: null, forHost: false });
        }
        // Everyone going can see a list for the event, so no share is needed.
        for (const list of lists) {
          if (list.itemCount >= FEW_ITEMS) continue;
          toDos.push({
            ...base,
            key: `addIdeas:${list._id}`,
            kind: 'addIdeas',
            listId: list._id,
            itemCount: list.itemCount,
            forHost: false,
          });
        }
      }

      const secretSanta = await ctx.db
        .query('secretSantas')
        .withIndex('by_event', q => q.eq('eventId', event._id))
        .unique();
      const isHost = isHostRole(attendance.role);

      if (isHost && !secretSanta && !event.secretSantaOff && !event.sourceBirthday && upcoming) {
        let people = 0;
        for await (const row of ctx.db.query('eventAttendees').withIndex('by_event', q => q.eq('eventId', event._id))) {
          if (row.status === 'going' || row.status === 'invited') people++;
        }
        if (people >= SECRET_SANTA_MIN_PEOPLE) {
          toDos.push({
            ...base,
            key: `setUpSecretSanta:${event._id}`,
            kind: 'setUpSecretSanta',
            listId: null,
            itemCount: null,
            forHost: true,
          });
        }
      }

      // Drawn, not sent: nobody has been told who they have.
      if (isHost && secretSanta?.status === 'drawn') {
        toDos.push({
          ...base,
          key: `sendNames:${event._id}`,
          kind: 'sendNames',
          listId: null,
          itemCount: null,
          forHost: true,
        });
      }

      if (secretSanta?.status === 'sent' && date !== null && lastDay !== null) {
        const assignment = await ctx.db
          .query('secretSantaAssignments')
          .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', user._id))
          .unique();
        if (assignment && !assignment.giftReady && comingUp(today, date, lastDay, MATCH_GIFT_WINDOW_DAYS)) {
          toDos.push({
            ...base,
            key: `matchGift:${event._id}`,
            kind: 'matchGift',
            listId: null,
            itemCount: null,
            forHost: false,
          });
        }
      }
    }

    // Lists for Christmas, your birthday, or another date. These come round
    // again, so their keys include the date: dismissing this year's leaves
    // next year's alone.
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', q => q.eq('userId', user._id))
      .unique();
    const birthday = profile?.birthday;
    const nextBirthday = birthday ? nextYearly(birthday.month, birthday.day, today) : null;

    for (const list of myLists) {
      const occasion = list.occasion;
      if (!occasion || occasion.kind === 'event' || list.itemCount >= FEW_ITEMS) continue;
      let date: string | null = null;
      let label = list.title;
      let window = WINDOW_DAYS;
      if (occasion.kind === 'christmas') {
        date = nextYearly(12, 25, today);
        label = 'Christmas';
        window = CHRISTMAS_WINDOW_DAYS;
      } else if (occasion.kind === 'birthday') {
        date = nextBirthday;
        label = 'Your birthday';
      } else {
        date = occasion.date;
      }
      if (!date || !comingUp(today, date, date, window)) continue;
      // Nobody else can see it, so more ideas wouldn't help anyone yet.
      if (!(await isShared(ctx, list._id))) continue;
      toDos.push({
        key: `addIdeas:${list._id}:${date}`,
        kind: 'addIdeas',
        label,
        occasion: occasion.kind,
        date,
        eventId: null,
        listId: list._id,
        itemCount: list.itemCount,
        forHost: false,
      });
    }

    // Your birthday, if people can see it and you have no list for it.
    const birthdayShown = (profile?.birthdayVisibility ?? 'private') !== 'private';
    if (
      nextBirthday &&
      birthdayShown &&
      comingUp(today, nextBirthday, nextBirthday, WINDOW_DAYS) &&
      !myLists.some(l => l.occasion?.kind === 'birthday')
    ) {
      toDos.push({
        key: `makeList:birthday:${nextBirthday}`,
        kind: 'makeList',
        label: 'Your birthday',
        occasion: 'birthday',
        date: nextBirthday,
        eventId: null,
        listId: null,
        itemCount: null,
        forHost: false,
      });
    }

    const shown = [];
    for (const toDo of toDos) {
      if (!(await isDismissed(ctx, user._id, toDo.key))) shown.push(toDo);
    }

    // Soonest first (undated last). On the same day, host to-dos first, since
    // other people are waiting on them.
    return shown.sort(
      (a, b) =>
        (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
        Number(b.forHost) - Number(a.forHost) ||
        KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
        a.label.localeCompare(b.label),
    );
  },
});

// Hides a to-do for good, or until its occasion comes round again. Set up
// Secret Santa isn't dismissed here: dismissing it turns Secret Santa off for
// the event (secretSanta.setOff).
export const dismiss = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (args.key.length === 0 || args.key.length > 200) throw new ConvexError('That to-do can’t be dismissed.');
    const existing = await ctx.db
      .query('toDoDismissals')
      .withIndex('by_userId_and_key', q => q.eq('userId', user._id).eq('key', args.key))
      .first();
    if (!existing) await ctx.db.insert('toDoDismissals', { userId: user._id, key: args.key });
  },
});
