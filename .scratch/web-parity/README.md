# Web parity

Status: in progress

Bring `apps/web` up to feature parity with `apps/mobile` (the source of truth), using the same Convex API (`packages/backend`), shared logic (`packages/shared`) and design tokens (`packages/design-tokens`). Responsive (phone width and desktop), with web-native patterns: URL routes, links, keyboard, native date/time inputs, dialogs instead of sheets.

## Decision: rewrite the screens, keep the plumbing

The old web app was built before most of the mobile features existed (no Home to-dos/notices, Messages, Asks, Gift Shopping, private ideas, Secret Santa setup/review, invite pickers...). Its screens were organised around a different navigation (`/dashboard/...`, groups/events/lists tabs inside one dashboard) and used react-query loaders, so adapting them screen by screen would have cost more than porting mobile's screens directly. It also didn't typecheck against the current backend (birthday is now `{ month, day, year? }`).

Kept, because it works and is the hard-to-get-right part:

- TanStack Start + the Better Auth proxy (`/api/auth/*` → Convex `.site`), server-side token fetch in `__root`, `ConvexBetterAuthProvider`.
- `/invite/$token` flow (adapted to the new routes and UI).
- The shadcn/radix setup (`radix-ui`, `class-variance-authority`, lucide).

Rewritten: every route and component under `apps/web/src`, ported from `apps/mobile/src/screens` and `components`. Data access uses `convex/react` (`useQuery` / `useMutation`), the same hooks mobile uses, so screen logic ports nearly line for line. Tailwind reads the colors, type scale and radii straight from `@family-gifts/design-tokens` via `@config`, like mobile's `tailwind.config.js` does.

## Routes

Mobile tab → web route. Mobile modals become their own pages (shown as a centered sheet on desktop); mobile's in-screen sheets (Ask for ideas, Private idea, Ask anonymously, Keep apart) become dialogs.

| Mobile screen | Web route |
| --- | --- |
| welcome | `/welcome` |
| sign-in (`mode`) | `/sign-in?mode=signUp` |
| forgot-password | `/forgot-password` |
| reset-password | `/reset-password` |
| (web only) invite link landing | `/invite/$token` |
| (dashboard) index | `/` |
| shopping | `/shopping` |
| threads | `/messages` |
| threads/[id] | `/messages/$id` |
| profile | `/profile` |
| change-password (+ reset) | `/profile/password` |
| (my-lists) lists | `/lists` |
| lists/new (`eventId`, `occasion`) | `/lists/new` |
| lists/[id] (mine or theirs) | `/lists/$id` |
| lists/[id]/edit | `/lists/$id/edit` |
| lists/[id]/add-item | `/lists/$id/add` |
| lists/[id]/items/[itemId] (edit mine / their item sheet) | `/lists/$id/items/$itemId` |
| (groups) groups → "People" | `/people` |
| groups/new | `/groups/new` |
| groups/[id] | `/groups/$id` |
| groups/[id]/edit | `/groups/$id/edit` |
| groups/[id]/invite | `/groups/$id/invite` |
| people/[id] | `/people/$id` |
| (events) events | `/events` |
| events/new (+ add-people) | `/events/new` |
| events/[id] | `/events/$id` |
| events/[id]/edit | `/events/$id/edit` |
| events/[id]/invite | `/events/$id/invite` |
| events/[id]/secret-santa | `/events/$id/secret-santa` |
| events/[id]/secret-santa/setup (+ keep-apart) | `/events/$id/secret-santa/setup` |
| (old emails) `/dashboard/...` | redirects to the same path without `/dashboard` |

## Feature checklist

Legend: done / partial / todo / n/a.

### Auth
- [ ] Welcome page — todo
- [ ] Log in / create account (first + last name, breached-password check) — todo
- [ ] Forgot password → emailed 6-digit code → new password, then logged in — todo
- [ ] Dev "sign in as" mock-user switcher (dev builds only) — todo
- [ ] Signed-out users redirected to welcome; signed-in users kept out of auth pages — todo
- [ ] Invite link page (group/event email invite or join link; sign in/up inline; Going / Can't go) — todo

### Navigation
- [ ] Tabs: Home (unread badge), My Lists, People (group invite badge), Events (event invite badge) — bottom bar on phones, top bar on desktop — todo

### Home
- [ ] Greeting + date, avatar → profile — todo
- [ ] Event invitation cards (Going / Can't go) — todo
- [ ] Group invitation cards (Join / Decline) — todo
- [ ] Notices (draw redone), dismissible — todo
- [ ] Messages section: Asks grouped by occasion with Make a list, Secret Santa Asks, unread threads, See all — todo
- [ ] Next up event card — todo
- [ ] Gift Shopping card (shopping for N · N to buy) — todo
- [ ] To-dos (show 4 / show all, dismiss, Secret Santa off confirm) — todo

### Gift Shopping
- [ ] Upcoming by occasion, Just ideas, Already happened — todo
- [ ] Claims with Bought checkbox (optimistic) + prompt to mark Secret Santa gift ready — todo
- [ ] Hidden Match card with Show/Hide, budget line, Gift ready switch, Secret Santa Ask — todo
- [ ] Suggestions (claim from list, private ideas) — todo

### Messages
- [ ] Threads list — todo
- [ ] Thread: messages, open Asks with Make a list, reply box, mark read, can't-send reason, Secret Santa giver note — todo

### Profile
- [ ] Name edit (web extra: mobile shows the label but has no editor yet; uses `profiles.updateName`) — todo
- [ ] Birthday (month/day, show age + year), who can see it, per-group picks — todo
- [ ] Event reminders, share new lists with, currency, appearance (device setting), discoverable — todo
- [ ] Account: email, change password (current + new, or Forgot it? → code reset), groups count, sign out — todo

### My Lists
- [ ] Lists + archived section, edit/archive/unarchive per row (menu instead of swipe) — todo
- [ ] Empty state — todo
- [ ] New list (occasion options, date, groups it's shared with, defaults from profile; `eventId`/`occasion` params) — todo
- [ ] Edit list — todo
- [ ] My list page: occasion + sharing summary, add, menu (edit/archive, restore/delete permanently), empty state (paste a link / type it in) — todo
- [ ] Item rows: edit, priority, delete — todo
- [ ] Add item: link parse on paste/blur, auto image upload, photo upload, name, price, notes, priority — todo
- [ ] Edit item: + quantity, move to list, remove photo — todo

### Someone else's list
- [ ] Their list: All / Still open filter, open count, claim status per item, claim / one more / unclaim, add private idea — todo
- [ ] Their item details: image, price/store, notes, I'll get this / Unclaim, open in store — todo

### People
- [ ] Groups with member summaries, pending group invites (Join / Decline), empty state — todo
- [ ] New group (name, members can invite, share lists) — todo
- [ ] Group page: members (roles, promote/demote/remove), pending invites, events, invite link (share/copy/create/reset), members can invite, leave, delete — todo
- [ ] Edit group (rename) — todo (mobile's screen is still a stub; web uses `groups.update`)
- [ ] Invite members (guest picker: search, suggestions, invite by email, share link, revoke) — todo
- [ ] Person page: their lists, ask for ideas, private ideas (add/edit/delete) — todo

### Events
- [ ] Events list: invitations, upcoming by month, past, archived; per-row edit/archive/cancel/restore/delete — todo
- [ ] New event (name, description, dates, multi-day, times, location, invite groups, add people incl. share link before saving) — todo
- [ ] Edit event (+ Secret Santa on/off) — todo
- [ ] Event page: when/where, cancelled banner, going summary + avatars, Secret Santa row (setup/summary/undo/turn off), attendees with lists / make a list / ask for ideas / host actions, waiting-on invitees + revoke, menu (invite, copy link, can't go / can go, archive, cancel/restore, delete) — todo
- [ ] Invite guests (picker + groups, waiting invites + revoke, guests can share link, reset link) — todo

### Secret Santa
- [ ] Setup: who's in, budget, keep-apart rules (dialog with remember-for-group), mode, draw date / draw early, footnotes — todo
- [ ] Secret Santa page: reveal/hide Match, budget, match items, ask anonymously, gift ready + progress — todo
- [ ] Reviewed draw: drawn-not-sent banner, swap matches, send the names, host gift-ready pills — todo

## Env vars

`apps/web/.env.local` (gitignored):

- `VITE_CONVEX_URL` — the deployment's `.convex.cloud` URL (client + SSR).
- `VITE_CONVEX_SITE_URL` — the deployment's `.convex.site` URL (Better Auth proxy target, read on the server).

On the Convex deployment (`npx convex env set`): `SITE_URL` must be the web app's origin (e.g. `http://localhost:3000`). It's Better Auth's base/trusted origin and the base of invite links and email links.

## Stuck / needs Will

(filled in as I go)
