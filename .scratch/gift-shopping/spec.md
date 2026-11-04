# Gift Shopping

Status: ready

One page where you see everything you're buying: your Claims, your Secret Santa Match, and suggestions for the people you haven't claimed anything for yet. It's built from **Gifts to get**. See `GLOSSARY.md` for the terms (Claim, Bought, Private idea, Gift to get, Match, Gift ready, Send the names).

Mobile first. Web comes later.

## Home screen

- A summary card that opens Gift Shopping, e.g. "Shopping for 4 · 3 to buy".
  - "Shopping for N": how many Gifts to get are on the page.
  - "N to buy": your Claims on the page not yet marked Bought.
- To do drops its "Buy X" items. Claims live on Gift Shopping only. To do keeps the non-shopping tasks ("Set up Secret Santa", "Add a few ideas to your list").

## Who's on the page

A **Gift to get** is one person on one occasion. You get one when either:

- Someone is going to an upcoming event you're also going to, and they have a list whose occasion is that event.
- They're your Match in a Secret Santa whose names have been sent. Your Match always shows, list or not.

Not included: going Attendees with no list for the event (unless they're your Match), Invitees, people who can't go, and Connections you don't share an upcoming event with.

The same person on two occasions is two Gifts to get: "Mom · Christmas party" and "Mom · Birthday".

Every claim you've made shows up somewhere. A claim on someone's list for another dated occasion (Christmas, their birthday, another date) makes a Gift to get for that person and occasion, even though it gets no suggestions. Christmas and birthdays repeat, so a claim counts toward the first one on or after the day you made it. If you can't see someone's birthday, that Gift to get has no date.

**Claims on "Just ideas" lists** go on that person's soonest upcoming Gift to get from an event, so claiming a suggestion from their "Just ideas" list counts as claiming for them. If they have none, the claim shows under **Just ideas**, grouped by person. It stays until you unclaim it.

Undated events count as upcoming and never drop off.

## Order

1. Upcoming occasions, soonest first, then undated ones. Within each occasion:
   1. Your Match
   2. People you haven't claimed anything for
   3. People you've claimed something for
2. Claims on "Just ideas" lists.
3. **Already happened**: occasions that have passed but are still in the grace period, most recent first.

## Dropping off

A Gift to get stays on the page for 7 days after its occasion, then drops off, whether or not its Claims are Bought. For an event with an end date, count from the end date.

## A Gift to get

Header: the person's name and the occasion with its date, e.g. "Mom · Christmas party · Dec 25".

**Your Claims** for them, each with:

- The item, and how many you claimed if more than one.
- A **Bought** checkbox. Only you see it. The list's owner never does, and neither does anyone else splitting the item.

**Suggestions**, shown when you haven't claimed anything for them:

1. Items from their list for this occasion that still need claiming, highest priority first. A partly claimed item shows what's left: "2 of 4 still needed". Fully claimed items are left out.
2. Then items from their "Just ideas" lists, the same way.
3. Then your Private ideas for them.
4. If every item on their lists is claimed: "Everything on her list is claimed", followed by your Private ideas.

Each suggested item can be claimed with one tap. It then becomes one of your Claims, and the row moves down to "people you've claimed something for".

## Your Match

Your Match's Gift to get starts hidden ("Your Secret Santa", with a **Show** button), like the reveal on the Secret Santa page, so nobody sees it over your shoulder. Once shown, it also has:

- A Secret Santa badge.
- A **Gift ready** toggle, the same one as on the Secret Santa page.
- Your claimed total against the budget, e.g. "$32 of $40", using the prices on the items you claimed. Items with no price are left out of the total. No budget means no total.
- Marking one of your Match's items **Bought** asks "Mark your Secret Santa gift ready?" It doesn't set Gift ready on its own, since your gift might not come from their list.

Secret Santa states:

- **Drawn, not sent**: no Match shows, not even for hosts. The page is only about your own shopping.
- **Draw undone**: the badge, Gift ready toggle and budget go away. If they're still a Gift to get some other way, the row stays as a regular one, and your Claims and Bought marks stay as they were.

## Privacy

Everything on this page belongs to you. Nothing here is ever shown to the people you're buying for: not your Claims, not Bought, not your Private ideas. Gift ready keeps its existing rule: everyone in the draw sees how many are ready, never who.

## Not in this

- Totals other than the Match budget (per person, overall).
- Web.
- Claims on Christmas and birthday lists hanging around into next year. See `.scratch/stale-claims/spec.md`.
