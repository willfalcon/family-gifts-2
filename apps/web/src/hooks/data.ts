// Data hooks, ported from apps/mobile/src/hooks so both apps ask the backend
// the same questions the same way.
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { localToday } from '@/lib/utils';

// ---- You ----

/** The signed-in user. `undefined` while loading, `null` when signed out. */
export function useUser() {
  return useQuery(api.auth.getCurrentUser);
}

export function useProfile() {
  return useQuery(api.profiles.getMine);
}

/**
 * Saves some fields of the signed-in user's profile. The new values show on
 * screen right away and roll back by themselves if the save fails.
 */
export function useUpdateProfile() {
  return useMutation(api.profiles.updateMine).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.profiles.getMine, {});
    if (!current) return;
    const next = { ...current };
    if ('birthday' in args) next.birthday = args.birthday ?? undefined;
    if ('birthdayVisibility' in args) next.birthdayVisibility = args.birthdayVisibility;
    if ('birthdayGroupIds' in args) next.birthdayGroupIds = args.birthdayGroupIds;
    if ('notificationPreference' in args) next.notificationPreference = args.notificationPreference;
    if ('shareNewLists' in args) next.shareNewLists = args.shareNewLists;
    if ('currency' in args) next.currency = args.currency;
    if ('shirtSize' in args) next.shirtSize = args.shirtSize?.trim() || undefined;
    if ('notes' in args) next.notes = args.notes?.trim() || undefined;
    if ('discoverable' in args) next.discoverable = args.discoverable;
    store.setQuery(api.profiles.getMine, {}, next);
  });
}

// ---- Lists ----

export function useLists() {
  return useQuery(api.lists.myLists);
}

export function useArchivedLists() {
  return useQuery(api.lists.myArchivedLists);
}

export function useList(id: Id<'lists'>) {
  return useQuery(api.lists.get, { id });
}

export function useItems(listId: Id<'lists'>) {
  return useQuery(api.items.list, { listId });
}

export function useListShares(listId: Id<'lists'>) {
  return useQuery(api.listShares.list, { listId });
}

// Claim status per item, keyed by item id. Null for the list's owner (they
// never see claims).
export function useItemClaims(listId: Id<'lists'>) {
  return useQuery(api.claims.forList, { listId });
}

// ---- Groups ----

export function useGroups() {
  return useQuery(api.groups.myGroups);
}

export function useGroup(groupId: string) {
  return useQuery(api.groups.get, { id: groupId });
}

// Members of a group, each with their shared-idea counts and next occasion.
export function useGroupMembers(groupId: string) {
  return useQuery(api.groups.memberSummaries, { groupId, today: localToday() });
}

// Pending invites: null if the viewer can't manage the group.
export function useGroupInvites(groupId: string) {
  return useQuery(api.groups.listInvites, { groupId });
}

export function useGroupInviteLink(groupId: string) {
  return useQuery(api.groups.getInviteLink, { groupId });
}

export function useGroupEvents(groupId: string) {
  return useQuery(api.groups.listEvents, { groupId });
}

export function useMyGroupInvites() {
  return useQuery(api.groups.myInvites);
}

// ---- Events ----

export function useEvents() {
  return useQuery(api.events.myEvents);
}

// undefined while loading, null if it doesn't exist or the viewer isn't on it.
export function useEvent(id: string | undefined) {
  return useQuery(api.events.get, id ? { id } : 'skip');
}

export function useEventAttendees(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.listAttendees, eventId ? { eventId } : 'skip');
}

// Pending email invites. Manager-only on the server.
export function useEventInvites(eventId: Id<'events'> | undefined, canManage: boolean) {
  return useQuery(api.events.listInvites, eventId && canManage ? { eventId } : 'skip');
}

export function useEventPendingInviteCount(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.pendingInviteCount, eventId ? { eventId } : 'skip');
}

export function useEventInvitees(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.listInvitees, eventId ? { eventId } : 'skip');
}

// Lists with this event as their occasion that the viewer can open.
export function useEventOccasionLists(eventId: Id<'events'> | undefined) {
  return useQuery(api.lists.forEvent, eventId ? { eventId } : 'skip');
}

export function useEventInviteLink(eventId: Id<'events'> | undefined) {
  return useQuery(api.events.getInviteLink, eventId ? { eventId } : 'skip');
}

export function useMyEventInvites() {
  return useQuery(api.events.myInvites);
}

// ---- People ----

export function usePerson(id: string) {
  return useQuery(api.profiles.getPublic, { userId: id });
}

// Your own private ideas for this person. Only you ever see these.
export function usePrivateIdeas(forUserId: string | undefined) {
  return useQuery(api.privateIdeas.forPerson, forUserId ? { forUserId } : 'skip');
}

// ---- Secret Santa ----

export function useSecretSanta(eventId: Id<'events'> | undefined) {
  return useQuery(api.secretSanta.getState, eventId ? { eventId } : 'skip');
}

export function useMatchItems(eventId: Id<'events'> | undefined) {
  return useQuery(api.secretSanta.matchItems, eventId ? { eventId } : 'skip');
}

export function useSecretSantaSetupOptions(eventId: Id<'events'> | undefined) {
  return useQuery(api.secretSanta.setupOptions, eventId ? { eventId } : 'skip');
}

// ---- Gift shopping ----

export type GiftShopping = FunctionReturnType<typeof api.giftShopping.overview>;
export type GiftToGet = GiftShopping['upcoming'][number];
export type ShoppingClaim = GiftToGet['claims'][number];

export function useGiftShopping() {
  return useQuery(api.giftShopping.overview, { today: localToday() });
}

// "Shopping for 4 · 3 to buy".
export function shoppingSummary(data: GiftShopping) {
  const gifts = [...data.upcoming, ...data.recent];
  const claims = [...gifts.flatMap(g => g.claims), ...data.justIdeas.flatMap(p => p.claims)];
  return { shoppingFor: gifts.length, toBuy: claims.filter(c => !c.bought).length };
}

// Marks a claim Bought (or not), flipping it on the page straight away.
export function useSetBought() {
  return useMutation(api.claims.setBought).withOptimisticUpdate((store, args) => {
    const flip = (claims: ShoppingClaim[]) =>
      claims.map(c => (c.itemId === args.itemId ? { ...c, bought: args.bought } : c));
    for (const { args: queryArgs, value } of store.getAllQueries(api.giftShopping.overview)) {
      if (!value) continue;
      store.setQuery(api.giftShopping.overview, queryArgs, {
        upcoming: value.upcoming.map(g => ({ ...g, claims: flip(g.claims) })),
        recent: value.recent.map(g => ({ ...g, claims: flip(g.claims) })),
        justIdeas: value.justIdeas.map(p => ({ ...p, claims: flip(p.claims) })),
      });
    }
  });
}

// ---- Roles ----

export type EventRole = 'owner' | 'host' | 'guest';

export function isHostRole(role: string | undefined) {
  return role === 'owner' || role === 'host';
}
