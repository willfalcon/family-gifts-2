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
- [x] Welcome page — done
- [x] Log in / create account (first + last name, breached-password check) — done
- [x] Forgot password → emailed 6-digit code → new password, then logged in — done
- [x] Dev "sign in as" mock-user switcher (dev builds only) — done
- [x] Signed-out users redirected to welcome; signed-in users kept out of auth pages — done
- [x] Invite link page (group/event email invite or join link; sign in/up inline; Going / Can't go) — done

### Navigation
- [x] Tabs: Home (unread badge), My Lists, People (group invite badge), Events (event invite badge) — bottom bar on phones, top bar on desktop — done

### Home
- [x] Greeting + date, avatar → profile — done
- [x] Event invitation cards (Going / Can't go) — done
- [x] Group invitation cards (Join / Decline) — done
- [x] Notices (draw redone), dismissible — done
- [x] Messages section: Asks grouped by occasion with Make a list, Secret Santa Asks, unread threads, See all — done
- [x] Next up event card — done
- [x] Gift Shopping card (shopping for N · N to buy) — done
- [x] To-dos (show 4 / show all, dismiss, Secret Santa off confirm) — done

### Gift Shopping
- [x] Upcoming by occasion, Just ideas, Already happened — done
- [x] Claims with Bought checkbox (optimistic) + prompt to mark Secret Santa gift ready — done
- [x] Hidden Match card with Show/Hide, budget line, Gift ready switch, Secret Santa Ask — done
- [x] Suggestions (claim from list, private ideas) — done

### Messages
- [x] Threads list — done
- [x] Thread: messages, open Asks with Make a list, reply box, mark read, can't-send reason, Secret Santa giver note — done

### Profile
- [x] Name edit (web extra: mobile shows the label but has no editor yet; uses `profiles.updateName`) — done
- [x] Birthday (month/day, show age + year), who can see it, per-group picks — done
- [x] Event reminders, share new lists with, currency, appearance (device setting), discoverable — done
- [x] Account: email, change password (current + new, or Forgot it? → code reset), groups count, sign out — done

### My Lists
- [x] Lists + archived section, edit/archive/unarchive per row (menu instead of swipe) — done
- [x] Empty state — done
- [x] New list (occasion options, date, groups it's shared with, defaults from profile; `eventId`/`occasion` params) — done
- [x] Edit list — done
- [x] My list page: occasion + sharing summary, add, menu (edit/archive, restore/delete permanently), empty state (paste a link / type it in) — done
- [x] Item rows: edit, priority, delete — done
- [x] Add item: link parse on paste/blur, auto image upload, photo upload, name, price, notes, priority — done
- [x] Edit item: + quantity, move to list, remove photo — done

### Someone else's list
- [x] Their list: All / Still open filter, open count, claim status per item, claim / one more / unclaim, add private idea — done
- [x] Their item details: image, price/store, notes, I'll get this / Unclaim, open in store — done

### People
- [x] Groups with member summaries, pending group invites (Join / Decline), empty state — done
- [ ] New group (name, members can invite, share lists) — todo
- [ ] Group page: members (roles, promote/demote/remove), pending invites, events, invite link (share/copy/create/reset), members can invite, leave, delete — todo
- [ ] Edit group (rename) — todo (mobile's screen is still a stub; web uses `groups.update`)
- [ ] Invite members (guest picker: search, suggestions, invite by email, share link, revoke) — todo
- [x] Person page: their lists, ask for ideas, private ideas (add/edit/delete) — done

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

## Next up

Handed off mid-way (agent stopped at commit below). State of `web-parity`:

- `npm run build --workspace=@family-gifts/web` passes.
- `npx tsc --noEmit -p apps/web` only fails on links to routes that don't exist yet (`/groups/*`, `/events/*`). Run the build first: it regenerates `src/routeTree.gen.ts`, which tsc needs.
- Written but untested in a browser (no Convex deployment available here): everything marked done.
- `src/components/guest-picker.tsx` (GuestPicker, useGuests, shareLink/copyLink, useShareEventLink) is written and ready for the invite pages.

To do, in order:

1. Groups: `routes/_app/groups/new.tsx`, `groups/$id/index.tsx`, `groups/$id/edit.tsx` (rename via `groups.update`), `groups/$id/invite.tsx` (GuestPicker + revoke). Port from `apps/mobile/src/screens/{new-group,group,invite-members}.tsx`.
2. Events: `routes/_app/events/index.tsx`, `events/new.tsx` (event form + GuestPicker inline instead of mobile's Add People screen; "share link" saves the event first), `events/$id/index.tsx`, `events/$id/edit.tsx`, `events/$id/invite.tsx`. Use `hooks/event-actions.ts` (done) and `InviteAnswerButtons` from `components/home.tsx`. Port from `apps/mobile/src/screens/{events,event,invite-guests}.tsx` and `components/event-form.tsx`, `event-list-item.tsx`, `invitation-list-item.tsx`.
3. Secret Santa: `events/$id/secret-santa/index.tsx` and `events/$id/secret-santa/setup.tsx` (keep-apart as a `SheetDialog`). Port `screens/{secret-santa,secret-santa-setup,keep-apart}.tsx` and `components/secret-santa/*`. `useSecretSanta`, `useMatchItems`, `useSecretSantaSetupOptions` are in `hooks/data.ts`; `SecretSantaAsk` is in `components/sheets.tsx`.
4. Then: tsc clean, `npm run format`, update this checklist, remove now-unused deps from apps/web/package.json (`react-day-picker`, `cn`; keep `@convex-dev/react-query`/`@tanstack/react-query`, the root route uses them), add `@family-gifts/design-tokens` to apps/web dependencies (resolves today only through the workspace symlink), open the PR.

## Stuck / needs Will

- Couldn't run against a real Convex deployment (no `.env.local`), so nothing has been clicked through. Needs a manual pass with `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` set and `SITE_URL` on the deployment pointing at the web origin.
- Auto-photo from a pasted link fetches the store image in the browser; sites that block cross-origin requests just won't get a photo (mobile fetches natively, so it doesn't hit this). A server-side fetch in `linkParser` would fix it, but that's a backend change I left alone.
- Dark mode: the Appearance setting is saved and toggles `.dark`, but the design tokens have no dark palette, so nothing changes visually (same as mobile).
