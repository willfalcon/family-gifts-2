// Shared by the Secret Santa review screen (to dim rows that can't be
// swapped) and secretSanta.swap (which enforces it), so the two never disagree.

export interface MatchPair {
  giverUserId: string;
  receiverUserId: string;
}

// "giver must not receive excludedUserId". Keep-apart rules are stored as a
// pair of these, one each way.
export interface Exclusion {
  userId: string;
  excludedUserId: string;
}

export type SwapProblem = { kind: 'self'; userId: string } | { kind: 'keptApart'; userId: string; otherUserId: string };

// Why `a` and `b` can't trade Matches (a gets b's, b gets a's), or null if
// they can: nobody may end up giving to themselves or to someone they're
// kept apart from.
export function swapProblem(a: MatchPair, b: MatchPair, exclusions: Exclusion[]): SwapProblem | null {
  const trades = [
    { giver: a.giverUserId, receiver: b.receiverUserId },
    { giver: b.giverUserId, receiver: a.receiverUserId },
  ];
  for (const { giver, receiver } of trades) {
    if (giver === receiver) return { kind: 'self', userId: giver };
  }
  for (const { giver, receiver } of trades) {
    if (exclusions.some(e => e.userId === giver && e.excludedUserId === receiver)) {
      return { kind: 'keptApart', userId: giver, otherUserId: receiver };
    }
  }
  return null;
}
