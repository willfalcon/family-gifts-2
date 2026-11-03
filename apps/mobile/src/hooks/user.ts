import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';

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
    // No row yet (or still loading): skip the instant update and let the
    // server's answer fill it in.
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
