import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';

import { api } from '@convex/_generated/api';
import { localToday } from '@/hooks/events';

export type GiftShopping = FunctionReturnType<typeof api.giftShopping.overview>;
export type GiftToGet = GiftShopping['upcoming'][number];
export type ShoppingClaim = GiftToGet['claims'][number];

// Everything you're buying, as Gifts to get. Passes the local "today" so
// occasions pass on the viewer's calendar, not the server's.
export function useGiftShopping() {
  return useQuery(api.giftShopping.overview, { today: localToday() });
}

// "Shopping for 4 · 3 to buy": how many Gifts to get are on the page, and how
// many of your claims there aren't Bought yet.
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
