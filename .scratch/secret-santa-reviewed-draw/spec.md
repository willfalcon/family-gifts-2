# Secret Santa: Reviewed draw

Status: ready

Let a host choose between a **Secret draw** (today's behaviour) and a **Reviewed draw**, where hosts see every Match and nobody is told until a host **sends the names**. See `GLOSSARY.md` for the terms.

## Setup screen (mobile)

- New **Matches** section, below Rules and above When to draw. Two options:
  - **Keep matches secret** (default): "Everyone is told their person right away after the draw. Nobody sees who has whom, including you."
  - **Let me see the matches**: "Review and swap matches first. Nobody is told until you send the names."
- With **Let me see the matches** picked and the viewing host in Who's in, show a box under the options: "You're in the draw, so you'll also see who's giving to you." It has a secondary button, **Leave me out of the draw**, that unticks them in Who's in (so the box goes away).
- The footnotes follow the mode. In a Reviewed draw, drop "Nobody sees who drew whom, not even hosts…" and "Everyone gets a notification", and say instead that nobody is told until you send the names.
- When a saved round reopens (scheduled, or after an undo), the mode is filled back in.

## Drawing

- **Secret draw**: unchanged. Drawing sends the names and emails everyone.
- **Reviewed draw, When to draw = Now**: tapping **Draw** draws the Matches, leaving the round **Drawn, not sent**. No emails. The host goes straight to the Secret Santa page.
- **Reviewed draw, with a date**: tapping **Save** goes back to the event page as today. When the scheduled or draw-early draw happens, the round becomes Drawn, not sent, and every host gets:
  - an email: "Names are drawn for [event]. Review them, then send the names." It links to the event.
  - a home-screen notice with the same message, opening the Secret Santa page.

  Neither goes out for Draw now. Every host's notice disappears once any host sends the names or undoes the draw, or when they dismiss it.

## Secret Santa page (mobile)

For hosts in a Reviewed draw, before and after sending:

- A table of every Match (giver → Match). Its look comes later. A host who's in the draw sees their own reveal card above it as usual.
- A host with no Match of their own can open the page (today it sends them back).
- While Drawn, not sent:
  - A banner at the top: "Drawn [when] · Not sent yet" / "Nobody has been told who they have. Make any changes, then send the names."
  - [when]: "just now" (under a minute), "5 min ago", "3 hours ago", "yesterday", the weekday within a week ("Mon"), then the date ("Nov 2").
  - Below the table, a primary **Send names to N people** button (N = how many are in the draw). It asks for confirmation ("Everyone in the draw gets an email with their Match. You can't change matches after this."), then sends the existing assignment emails, and the round becomes sent.
- In a Reviewed draw the reveal card says "Keep it secret." instead of "Keep it secret. Not even the hosts know."

## Event page

- **Hosts**, Drawn, not sent: the row reads "Names drawn · Not sent yet" and opens the Secret Santa page. The ⋯ menu has **Undo draw**. Undoing here adds no notices and leaves no "Draw undone" state for guests. It clears the Matches and returns to setup with everything filled in, as today.
- **Guests**: no change until the names are sent. Drawn, not sent looks the same to them as not drawn yet.

## Backend

- `secretSantas`:
  - replace `private: boolean` with `mode: 'secret' | 'reviewed'`
  - `status` becomes `'draft' | 'drawn' | 'sent'`. A Secret draw goes from `draft` straight to `sent`.
  - add `drawnAt`, and keep `sentAt` for when names were sent
- `setup` takes `mode`. `draw()` only sends emails and moves to `sent` in a Secret draw. In a Reviewed draw it sets `drawn` + `drawnAt`, and for scheduled and draw-early draws it emails the hosts and adds the host notices.
- `getState`: matches go to hosts only when `mode === 'reviewed'`. A participant's own Match still only shows once `sent`. Expose `mode`, `drawnAt`, and the count in the draw.
- `send`: works on a `drawn` Reviewed draw. It clears the hosts' notices.
- `undoDraw`: also allowed from `drawn`. It adds no participant notices there, sets no `undoneAt`, and clears the hosts' notices.
- `notices.kind` adds `'secretSantaDrawn'`.
- Remove the old web flow: `generate`, and the web components that call it (configure form, draft view). Keep `swap`, now for `drawn` Reviewed draws, for the changes step.

## Later

- How the matches table looks.
- Making changes (swapping) before sending.
- Warning when co-hosts are in a Reviewed draw.
- The web version of the new setup flow.
