# Claims on repeating occasions never go away

Status: needs-triage

Christmas and "My birthday" lists come round every year, but their Claims never end. If you claim Sarah's running vest on her Christmas list in 2026, give it to her, and never unclaim it, it's still marked claimed in December 2027. Nobody else will pick it up, and Sarah probably wants it off her list anyway.

Gift Shopping (`.scratch/gift-shopping/spec.md`) hides these once the occasion is 7 days past, so the claim disappears from the claimer's view but stays on the list for everyone else.

Options raised so far:

- Claims on a repeating occasion clear themselves after the occasion passes.
- After the occasion, ask the claimer: "Did you give this? Remove it from Sarah's list?"
- Leave it to the list owner to tidy their list (they can't see Claims, so they don't know what was given).

Also check event lists. They don't repeat, but they could have the same problem if a list gets moved to a new event.
