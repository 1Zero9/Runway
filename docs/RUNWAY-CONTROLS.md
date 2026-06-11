# RUNWAY-CONTROLS.md — State, Controls, Search & the Wow Pass

**Companion to RUNWAY-BRIEF.md** (design tokens, type, copy rules, and guardrails there still apply — read it first). This brief fixes what shipped broken or missing: dead/one-way buttons, no unclick, no search, no add-to-list, unclear fav/seen behaviour, and a UI that's clean but flat. Work phases in order; log everything in UI-NOTES.md.

**The root cause to internalise before coding:** the current controls are fire-and-forget. They write (sometimes) but never read state back, can't be reversed, and don't combine. This brief replaces them with a single title state model + one universal toggle standard. Do not patch individual buttons — fix the system.

---

## Phase 0 — Interaction audit (find every broken wire)

Before building anything new, produce `docs/CONTROL-AUDIT.md`:

1. Inventory **every interactive element** in the app: location, label, intended behaviour, current handler, API route called, DB write performed, and whether the UI re-renders from server state afterwards. A table, one row per control.
2. Classify each: ✅ works round-trip / ⚠️ writes but no feedback / ❌ dead (no handler or failing call) / 🔁 one-way (no reverse action).
3. Verify by tracing code AND testing against the dev DB — a button is only ✅ if: click → API 200 → row changed → UI reflects it → reverse action exists → reverse works.
4. Fix outright dead handlers and failing API calls now (wrong route names, missing await, swallowed errors). Do not redesign yet — just make existing wires carry current.
5. Add a `lib/actions.ts` (or equivalent) so every mutation goes through one typed layer — no more inline fetch calls scattered through components.

**Acceptance:** the audit doc exists with zero ❌ rows remaining; every mutation flows through the single actions layer; UI-NOTES.md records what was dead and why.

## Phase 1 — The title state model

One mental model for every show and film, three independent layers:

**Layer 1 — Relationship (mutually exclusive, one per title):**
- `none` — not in Runway
- `watchlisted` — want to watch
- `tracking` — actively watching (has or will have progress)
- `finished` — completed (derived when all episodes watched, or set directly via "Seen it")
- `abandoned` — consciously dropped (explicit user action; removes from Continue/Shortlist without deleting history)

Transitions are explicit and all reversible: watchlist→tracking ("Start watching"), tracking→abandoned ("Drop it"), abandoned→tracking ("Pick it back up"), finished→tracking (new season arrives, auto), any→none ("Remove" — soft-delete keeping watch_events).

**Layer 2 — Flags (independent booleans, combinable with ANY relationship):**
- `favourite` — heart. A finished show can be favourited; so can one you're mid-way through.
- `recommended` — flagged for sharing; adds to a share list (Phase 4).

**Layer 3 — Progress:** watch_events, exactly as in RUNWAY-BRIEF.md. Untouched by flags.

This is what makes "I've seen it, I love it, and I'd recommend it" three independent taps on the same title instead of fighting buttons.

**Implementation:**
1. Schema (additive): `relationship` enum + `relationship_changed_at` on the title row; `favourited_at` and `recommended_at` nullable timestamps (timestamps, not booleans — free history).
2. **"Seen it"** = one action that sets relationship=finished AND bulk-writes watch_events for all aired episodes (source='bulk'). For films: sets watched_at. It must be available from search results and detail pages — this is how pre-Runway history gets in.
3. Derivations updated: `finished` auto-applies when last aired episode is logged; reverts to `tracking` automatically when a new season airs (and the NEW_SEASON rule picks it up).
4. State machine lives in one tested module (`lib/title-state.ts`): legal transitions, derived states, and what each state means for dashboard eligibility. Unit tests for every transition including the illegal ones.

**Acceptance:** a title can simultaneously be finished + favourite + recommended; dropping and re-picking-up a show preserves all history; "Seen it" on a 5-season show takes one tap and lands it in Library/Finished with full progress.

## Phase 2 — The toggle standard (every control, no exceptions)

One interaction contract applied to every stateful control in the app:

1. **Toggles, not triggers.** Every state button reads current state and shows it: resting = `--surface-sunken` chip with outline icon; active = `--accent-soft` background, red filled icon, and the label flips ("Watchlist" → "On your list", "Favourite" → "Favourited", "Mark watched" → "Watched ✓"). Clicking again reverses. `aria-pressed` on all of them.
2. **Optimistic + undoable.** UI updates instantly; sync in background; on failure revert with a quiet toast. Every mutation shows a 5-second toast with **Undo** ("Marked S02E05 watched — Undo", "Added to watchlist — Undo"). Undo calls the exact reverse action. One toast at a time, bottom-centre, never stacking.
3. **Destructive-ish actions get a beat, not a modal.** "Drop it" and "Remove" use a two-tap confirm in place (button becomes "Sure? Drop it" for 3 seconds) — no confirmation dialogs anywhere.
4. **Up next cards advance in place.** Marking the episode watched: progress hairline fills, card content crossfades to the *next* episode (S02E05 → S02E06) with the Undo toast. If that was the last available episode, the card crossfades to "Caught up ✓" then slides out after 2s. Never a dead click, never a vanishing card with no explanation.
5. **Episode grid squares** follow the same contract: tap = toggle that single episode; the "Watched up to here" bulk option appears on unwatched squares per RUNWAY-BRIEF.md Phase 5; bulk actions get Undo toasts too (reverse = delete that bulk batch, which is why watch_events carries `source`).
6. **Loading states:** controls never show spinners for optimistic actions; only non-optimistic fetches (search, page loads) may, and prefer skeletons.

**Acceptance:** every control in the Phase 0 audit table is now ✅ with a working reverse; clicking any state button twice returns the world to exactly its prior state; pull the network cable mid-action and the UI reverts with a toast rather than lying.

## Phase 3 — Global search (the missing front door)

1. **Invocation:** persistent search field in the top bar (icon + "Search shows & films…") and `/` or `Cmd/Ctrl+K` opening a command-palette-style overlay. Mobile: search icon in the nav opens a full-screen sheet, input auto-focused.
2. **Two result groups, clearly labelled:**
   - **In your library** — local matches (instant, from your DB) with poster thumb, relationship badge, and progress line ("Tracking · next S02E05"). Selecting jumps to detail.
   - **Add something new** — TMDB multi-search (shows + films), debounced 300ms, poster thumb, year, type badge. Filter obvious noise (no-poster, very-low-vote results demoted).
3. **Quick actions on every TMDB result row** — the whole point, no detail-page detour needed: `+ Watchlist`, `▶ Track`, `✓ Seen it`. Each follows the Phase 2 toggle standard (instant, toast+undo, row updates to show new state). `Seen it` triggers the bulk operation; for multi-season shows it asks one inline question — "All of it / Up to where?" — the latter deep-linking to the detail catch-up grid.
4. **Keyboard:** arrow keys navigate, Enter opens detail, `W/T/S` fire the three quick actions on the highlighted row. Esc closes.
5. Recent searches (last 5, local) shown when the overlay opens empty; a "Browse your library" link at the bottom.

**Acceptance:** from anywhere, adding a show you've fully seen takes: `/` → type 3 letters → `S` → done, under 5 seconds; library and TMDB results never visually interleave; works fully on mobile sheet.

## Phase 4 — Seen → Favourite → Recommend (the flow that's missing)

1. **The completion moment is the hook.** Whenever a title reaches `finished` (last episode logged, or "Seen it"), the toast/detail page offers a one-time follow-up chip row: **"♥ Favourite · 📣 Recommend"**. Optional, dismissible, never shown again for that title. This is where "I've seen it, loved it, want to recommend it" becomes two taps instead of a hunt.
2. **Favourite** is available everywhere a title appears (detail page primary position; hover/long-press on cards) — but the completion moment is its prime placement. Favourites: get a small heart on Library cards, a Favourites filter in Library, and **boost Worth a look seeding** (favourites weigh double when picking TMDB recommendation seeds).
3. **Recommend → share lists.** Tapping Recommend opens a minimal picker: existing share lists + "New list…". Adds the title with an optional one-line note ("Class — you'd love S2"). Recommended titles show a small 📣 mark in Library and the list is reachable at its `/share/[slug]` URL to send on. This wires the orphaned share feature into the daily flow.
4. **Library gets a filter bar** (quiet chips, toggle standard): All · Watching · Watchlist · Finished · Favourites · Recommended · Abandoned. Counts in `--ink-faint`. Default view: Watching.
5. Abandoned section styled compassionately — small thumbs, "Dropped in March", one-tap "Pick it back up".

**Acceptance:** finish a show → favourite it → recommend it to a list in three taps from the completion toast; Library filters compose with search; share list reflects the recommendation immediately.

## Phase 5 — The Wow pass (the missing atmosphere)

The current build is clean but flat — a grey page with white cards. The missing ingredient is **imagery in the page itself**, not just inside cards. Apple TV's light mode is the reference: editorial, airy, but cinematic. Apply in this order, restraint intact:

1. **The ambient hero (the big one).** Behind the greeting + Shortlist area, render the #1 Shortlist pick's backdrop: full-bleed, `scale(1.1)` with heavy blur (40–60px), washed toward white with a `--bg` gradient so it reads at perhaps 12–18% perceived strength at the top, dissolving fully into `--bg` by the time content rows begin. Ink text must stay AAA-legible over it. Crossfade 400ms when the top pick changes (daily, or on time-fit re-rank). This single element gives every day a different colour mood, supplied by your own viewing — that's the wow.
2. **Masthead moment.** Make the greeting earn its serif: date small caps above, then a large Fraunces line that's actually useful — "3 shows on the go · Severance is back Friday" (generated from the same dashboard query). One line, no stats dump.
3. **Detail pages inherit the treatment:** the existing backdrop header, but let the dominant colour tint the page's top 300px at ~4% before fading to `--bg` — the page feels *of* the show.
4. **Skeletons, not spinners:** shimmering placeholder cards matching real layout for any non-instant load (search, guide). Shimmer = `--surface-sunken` → slightly lighter sweep, 1.2s.
5. **Micro-motion budget (and no more):** card hover lift (already specced), Shortlist cards rising 8px with 30ms stagger on first paint, the up-next crossfade from Phase 2, toast slide-up, and the View Transitions poster morph. Everything else static. All inside reduced-motion guards.
6. **The subtraction check:** after the hero lands, re-audit — the ambient backdrop replaces the need for any other decoration. If a border, gradient, or icon now feels redundant, delete it.

**Acceptance:** screenshot the dashboard on two different days/top-picks — visibly different moods, same structure; text contrast passes AA minimum everywhere over the hero; with reduced motion enabled the app is fully static but identical in layout.

---

## Appendix — Manual QA checklist (run after Phases 2 and 4)

For each: do it, undo it, refresh, confirm persistence.

- [ ] Watchlist a film from search; unwatchlist from its card
- [ ] Track a show from search; mark 3 episodes via up-next; undo the third
- [ ] "Seen it" on a multi-season show from search ("All of it"); confirm Library/Finished + full grid
- [ ] "Watched up to here" mid-season; undo the bulk; redo it
- [ ] Favourite a finished show from the completion chips; unfavourite from Library
- [ ] Recommend to a new share list with a note; open the share URL; remove the recommendation
- [ ] Drop a show; confirm it leaves Shortlist/Continue; pick it back up; confirm progress intact
- [ ] Toggle the same episode square 4 times rapidly — final state correct, no duplicate events
- [ ] Kill network, tap an up-next card — UI reverts with toast
- [ ] Keyboard-only: search, add, track, favourite a title without touching the mouse

## Guardrails (additions to RUNWAY-BRIEF.md's)

- No confirmation modals; two-tap inline confirms only.
- No new mutation may bypass `lib/actions.ts` or ship without its reverse action.
- The completion chip row appears once per title, ever — track dismissal.
- Hero imagery never reduces text contrast below AA; when in doubt, wash whiter.
