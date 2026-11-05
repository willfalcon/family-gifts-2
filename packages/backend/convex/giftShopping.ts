import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { AVATAR_COLORS, type AvatarColor } from './avatarColors';
import { wantedQuantity } from './claims';
import { getAttendance } from './events';
import { getMembership } from './groups';
import { hasListAccess } from './listShares';
import { addDays, nextYearly, normalizeToday } from './occasions';
import { colorFor } from './people';

// Gift Shopping: everything the viewer is buying, as Gifts to get (one person
// on one occasion). See GLOSSARY.md and .scratch/gift-shopping/spec.md.

// How long a Gift to get stays after its occasion before dropping off.
const GRACE_DAYS = 7;
// How many of someone's list items to suggest at most.
const SUGGESTED_ITEM_COUNT = 5;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

type Occasion = {
  // Groups Gifts to get on the same occasion, e.g. "event:<id>", "christmas:2026-12-25".
  key: string;
  kind: 'event' | 'christmas' | 'birthday' | 'date';
  label: string;
  // When it is (its first day, for a multi-day event). Null when it has no
  // date we can show, e.g. an undated event or a birthday kept private.
  date: string | null;
  // Its last day: the grace period counts from here.
  lastDay: string | null;
  eventId: Id<'events'> | null;
};

type ClaimRow = {
  itemId: Id<'items'>;
  listId: Id<'lists'>;
  name: string;
  quantity: number;
  price: number | null;
  imageUrl: string | null;
  bought: boolean;
};

type Gift = {
  person: { userId: string; color: AvatarColor };
  occasion: Occasion;
  // Their lists for this occasion, to suggest from.
  lists: Doc<'lists'>[];
  claims: ClaimRow[];
  match: { budget: number | null; giftReady: boolean } | null;
  // Only Gifts to get from an event they're going to (or a Match) get
  // suggestions. Ones that exist only because of a claim don't.
  suggestible: boolean;
};

function isoDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

// The occasion a list is for, as seen from a claim made on `claimedOn`.
// Christmas and birthdays repeat, so a claim belongs to the first one on or
// after the day it was made. Null for "Just ideas" lists.
async function occasionFor(ctx: QueryCtx, list: Doc<'lists'>, claimedOn: string, viewerId: string) {
  const occasion = list.occasion;
  if (!occasion) return null;
  if (occasion.kind === 'event') {
    const event = await ctx.db.get(occasion.eventId);
    if (!event) return null;
    return eventOccasion(event);
  }
  if (occasion.kind === 'christmas') {
    const date = nextYearly(12, 25, claimedOn);
    return { key: `christmas:${date}`, kind: 'christmas', label: 'Christmas', date, lastDay: date, eventId: null } satisfies Occasion;
  }
  if (occasion.kind === 'birthday') {
    const birthday = await visibleBirthday(ctx, list.createdBy, viewerId);
    const date = birthday ? nextYearly(birthday.month, birthday.day, claimedOn) : null;
    return { key: `birthday:${date ?? 'unknown'}`, kind: 'birthday', label: 'Birthday', date, lastDay: date, eventId: null } satisfies Occasion;
  }
  return {
    key: `date:${occasion.date}`,
    kind: 'date',
    label: list.title,
    date: occasion.date,
    lastDay: occasion.date,
    eventId: null,
  } satisfies Occasion;
}

function eventOccasion(event: Doc<'events'>): Occasion {
  return {
    key: `event:${event._id}`,
    kind: 'event',
    label: event.name,
    date: event.date ?? null,
    lastDay: event.endDate ?? event.date ?? null,
    eventId: event._id,
  };
}

// `ownerId`'s birthday, if they let `viewerId` see it.
export async function visibleBirthday(ctx: QueryCtx, ownerId: string, viewerId: string) {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_userId', q => q.eq('userId', ownerId))
    .unique();
  if (!profile?.birthday) return null;
  const visibility = profile.birthdayVisibility ?? 'private';
  if (visibility === 'allGroups') return profile.birthday;
  if (visibility === 'someGroups') {
    for (const groupId of profile.birthdayGroupIds ?? []) {
      if (await getMembership(ctx, groupId, viewerId)) return profile.birthday;
    }
  }
  return null;
}

// How many of each item on a list are claimed, by anyone.
async function claimedByItem(ctx: QueryCtx, listId: Id<'lists'>) {
  const totals = new Map<Id<'items'>, number>();
  for await (const claim of ctx.db.query('claims').withIndex('by_list', q => q.eq('listId', listId))) {
    totals.set(claim.itemId, (totals.get(claim.itemId) ?? 0) + claim.quantity);
  }
  return totals;
}

// Items on these lists that still need claiming, highest priority first, then
// oldest. Also says whether the lists had any items at all.
async function openItems(ctx: QueryCtx, lists: Doc<'lists'>[]) {
  const open = [];
  let anyItems = false;
  for (const list of lists) {
    const claimed = await claimedByItem(ctx, list._id);
    for await (const item of ctx.db.query('items').withIndex('by_listId', q => q.eq('listId', list._id))) {
      anyItems = true;
      const wanted = wantedQuantity(item);
      const left = wanted - (claimed.get(item._id) ?? 0);
      if (left > 0) open.push({ item, list, wanted, left });
    }
  }
  open.sort(
    (a, b) =>
      PRIORITY_RANK[a.item.priority ?? 'medium'] - PRIORITY_RANK[b.item.priority ?? 'medium'] ||
      a.item._creationTime - b.item._creationTime,
  );
  return { open, anyItems };
}

export const overview = query({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const today = normalizeToday(args.today);
    // Anything on or after this day is still on the page.
    const cutoff = addDays(today, -GRACE_DAYS);
    const onPage = (date: string | null) => date === null || date >= cutoff;

    const gifts = new Map<string, Gift>();
    const giftFor = (userId: string, occasion: Occasion, color: AvatarColor, suggestible: boolean) => {
      const key = `${userId}|${occasion.key}`;
      let gift = gifts.get(key);
      if (!gift) {
        gift = { person: { userId, color }, occasion, lists: [], claims: [], match: null, suggestible };
        gifts.set(key, gift);
      }
      gift.suggestible ||= suggestible;
      return gift;
    };

    // 1. Everyone going to an event you're going to, who has a list for it,
    //    and your Match on each event.
    for await (const attendance of ctx.db.query('eventAttendees').withIndex('by_user', q => q.eq('userId', user._id))) {
      if (attendance.status !== 'going') continue;
      const event = await ctx.db.get(attendance.eventId);
      // Nobody needs a gift for a cancelled event.
      if (!event || event.cancelledAt !== undefined) continue;
      const occasion = eventOccasion(event);
      if (!onPage(occasion.lastDay)) continue;

      for await (const list of ctx.db
        .query('lists')
        .withIndex('by_occasion_event', q => q.eq('occasion.eventId', event._id))) {
        if (list.archivedAt !== undefined || list.createdBy === user._id) continue;
        const ownerAttendance = await getAttendance(ctx, event._id, list.createdBy);
        if (ownerAttendance?.status !== 'going') continue;
        giftFor(list.createdBy, occasion, ownerAttendance.color, true).lists.push(list);
      }

      const secretSanta = await ctx.db
        .query('secretSantas')
        .withIndex('by_event', q => q.eq('eventId', event._id))
        .unique();
      if (secretSanta?.status !== 'sent') continue;
      const assignment = await ctx.db
        .query('secretSantaAssignments')
        .withIndex('by_secretSanta_giver', q => q.eq('secretSantaId', secretSanta._id).eq('giverUserId', user._id))
        .unique();
      if (!assignment) continue;
      const matchAttendance = await getAttendance(ctx, event._id, assignment.receiverUserId);
      const gift = giftFor(
        assignment.receiverUserId,
        occasion,
        matchAttendance?.color ?? AVATAR_COLORS[0].hex,
        true,
      );
      gift.match = { budget: secretSanta.budget ?? null, giftReady: !!assignment.giftReady };
    }

    // 2. Your claims. Each lands on its Gift to get, making one if needed.
    //    Claims on "Just ideas" lists go on that person's soonest upcoming
    //    Gift to get from an event, or else in their own section at the end.
    const access = new Map<Id<'lists'>, boolean>();
    const canSee = async (list: Doc<'lists'>) => {
      if (!access.has(list._id)) access.set(list._id, await hasListAccess(ctx, list, user._id));
      return access.get(list._id)!;
    };
    const justIdeas = new Map<string, ClaimRow[]>();
    const unplaced: { ownerId: string; row: ClaimRow }[] = [];

    for await (const claim of ctx.db.query('claims').withIndex('by_user', q => q.eq('userId', user._id))) {
      const item = await ctx.db.get(claim.itemId);
      const list = item && (await ctx.db.get(item.listId));
      if (!item || !list || list.createdBy === user._id || !(await canSee(list))) continue;

      const row: ClaimRow = {
        itemId: item._id,
        listId: list._id,
        name: item.name,
        quantity: claim.quantity,
        price: item.price ?? null,
        imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
        bought: !!claim.bought,
      };

      const occasion = await occasionFor(ctx, list, isoDay(claim._creationTime), user._id);
      if (!occasion) {
        unplaced.push({ ownerId: list.createdBy, row });
        continue;
      }
      if (!onPage(occasion.lastDay)) continue;
      giftFor(list.createdBy, occasion, colorFor(list.createdBy), false).claims.push(row);
    }

    for (const { ownerId, row } of unplaced) {
      const soonest = [...gifts.values()]
        .filter(g => g.person.userId === ownerId && g.occasion.kind === 'event' && g.suggestible)
        .filter(g => g.occasion.lastDay === null || g.occasion.lastDay >= today)
        .sort((a, b) => (a.occasion.date ?? '9999').localeCompare(b.occasion.date ?? '9999'))[0];
      if (soonest) soonest.claims.push(row);
      else justIdeas.set(ownerId, [...(justIdeas.get(ownerId) ?? []), row]);
    }

    // 3. Names, suggestions, and the Match budget.
    const people = new Map<string, { name: string; image: string | null }>();
    const personInfo = async (userId: string) => {
      if (!people.has(userId)) {
        const person = await authComponent.getAnyUserById(ctx, userId);
        people.set(userId, { name: person?.name ?? 'Someone', image: person?.image ?? null });
      }
      return people.get(userId)!;
    };

    const hydrated = await Promise.all(
      [...gifts.values()].map(async gift => {
        const person = { ...gift.person, ...(await personInfo(gift.person.userId)) };
        const claimedTotal = gift.claims.reduce((sum, c) => sum + (c.price ?? 0) * c.quantity, 0);
        const match = gift.match && { ...gift.match, claimedTotal };
        const base = {
          key: `${gift.person.userId}|${gift.occasion.key}`,
          person,
          occasion: gift.occasion,
          claims: gift.claims,
          match,
        };
        if (gift.claims.length > 0 || !gift.suggestible) return { ...base, suggestions: null };
        return { ...base, suggestions: await suggestionsFor(ctx, gift, user._id, canSee) };
      }),
    );

    // Soonest occasion first (undated after), keeping each occasion together.
    // Within one: your Match, then people you haven't claimed for, then the rest.
    const rank = (g: (typeof hydrated)[number]) => (g.match ? 0 : g.claims.length === 0 ? 1 : 2);
    hydrated.sort(
      (a, b) =>
        (a.occasion.date ?? '9999').localeCompare(b.occasion.date ?? '9999') ||
        a.occasion.key.localeCompare(b.occasion.key) ||
        rank(a) - rank(b) ||
        a.person.name.localeCompare(b.person.name),
    );

    const isPast = (g: (typeof hydrated)[number]) => g.occasion.lastDay !== null && g.occasion.lastDay < today;

    return {
      upcoming: hydrated.filter(g => !isPast(g)),
      justIdeas: await Promise.all(
        [...justIdeas.entries()].map(async ([userId, claims]) => ({
          person: { userId, color: colorFor(userId), ...(await personInfo(userId)) },
          claims,
        })),
      ),
      // Occasions that have passed but are still in the grace period, most
      // recent first.
      recent: hydrated.filter(isPast).reverse(),
    };
  },
});

// What to suggest for someone you haven't claimed anything for: open items
// from their lists for this occasion, then from their "Just ideas" lists you
// can see, then your Private ideas for them.
async function suggestionsFor(
  ctx: QueryCtx,
  gift: Gift,
  viewerId: string,
  canSee: (list: Doc<'lists'>) => Promise<boolean>,
) {
  const ideaLists = [];
  for await (const list of ctx.db
    .query('lists')
    .withIndex('by_createdBy_archivedAt', q => q.eq('createdBy', gift.person.userId).eq('archivedAt', undefined))) {
    if (!list.occasion && (await canSee(list))) ideaLists.push(list);
  }

  const occasionItems = await openItems(ctx, gift.lists);
  const ideaItems = await openItems(ctx, ideaLists);
  const open = [...occasionItems.open, ...ideaItems.open];

  const privateIdeas = await ctx.db
    .query('privateIdeas')
    .withIndex('by_user_forUser', q => q.eq('userId', viewerId).eq('forUserId', gift.person.userId))
    .order('desc')
    .take(20);

  return {
    items: await Promise.all(
      open.slice(0, SUGGESTED_ITEM_COUNT).map(async ({ item, list, wanted, left }) => ({
        itemId: item._id,
        listId: list._id,
        listTitle: list.title,
        // Whether it's from their "Just ideas" lists rather than this occasion's.
        fromIdeas: !list.occasion,
        name: item.name,
        price: item.price ?? null,
        priority: item.priority ?? null,
        imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
        wanted,
        left,
      })),
    ),
    moreItems: Math.max(0, open.length - SUGGESTED_ITEM_COUNT),
    // Their lists have items, but every one is claimed.
    allClaimed: open.length === 0 && (occasionItems.anyItems || ideaItems.anyItems),
    // The list to open for "See list": their list for this occasion, if any.
    listId: gift.lists[0]?._id ?? null,
    privateIdeas: privateIdeas.map(idea => ({ _id: idea._id, title: idea.title, description: idea.description ?? null })),
  };
}
