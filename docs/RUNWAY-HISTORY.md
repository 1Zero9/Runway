# RUNWAY-HISTORY.md — 30 Years In: Backlog, Taste & the Better Story

**Builds on RUNWAY-POP.md (visual language) and RUNWAY-BRIEF/CONTROLS (data + toggle standards), which remain binding.** One guardrail is formally amended: the "no ratings" rule becomes "no reviews, no 5-star scales" — a three-level **sentiment** (Loved / Liked / Not for me) is now a core data point. It is a taste signal for the engine, not a critic system.

**Goal:** Steve can log 20–30 years of watch history (Star Trek, The X-Files, The Sopranos…) in minutes, mark how he felt about each, keep full episode tracking for current shows (Shrinking, Your Friends & Neighbors…), and have all of it recorded in the backend where it builds a taste profile that makes every recommendation and reason line smarter. The more Runway knows, the better the story it tells.

---

## The core distinction: Archive vs Active

Every show in the library is one or the other:

- **Archive** — watched in the past, logged at SHOW level only: finished + sentiment + (optional) rough era watched. NO episode rows are fabricated. Displays in Library with sentiment, not progress. Excluded from Continue/Shortlist/up-next forever unless reactivated.
- **Active** — current viewing, full episode tracking exactly as built.

Transitions: an archive show can be **reactivated** ("Rewatching" → becomes active with a fresh progress run, history preserved); an active show that finishes naturally becomes archive-equivalent (finished + sentiment prompt). A returning archive show (new season of something finished years ago) triggers the NEW_SEASON rule and offers one-tap reactivation.

## Phase A — Data model additions (additive, Neon)

1. `shows.log_mode` enum: `active` | `archive`.
2. `shows.archive_completed_at` nullable timestamp (when marked seen; NOT fake per-episode events — derived progress treats archive shows as 100% without watch_events rows, and stats later must distinguish real events from archive completions).
3. `sentiment` on shows and movies: enum `loved` | `liked` | `not_for_me`, nullable, with `sentiment_at`. Independent of relationship and favourite flag (favourite stays the scarce "all-timer" mark; expect many loved, few favourites).
4. `shows.watched_era` optional free pick (decade chips: 90s, 00s, 10s, 20s) — cheap colour for the story, never required.
5. Derived **taste profile** table (recomputed on change or nightly): weighted genres, keywords, networks/providers, and era preferences from loved (weight 3), liked (1), favourite (+2 bonus), not_for_me (−2). Pure SQL/TS derivation, inspectable at `/settings/taste` as a simple readout ("Your profile: crime drama, spy thriller, workplace comedy, hard sci-fi…").

**Acceptance:** marking The Sopranos as archive+loved creates exactly one show row update and zero episode rows; derived progress reports it 100%; taste profile updates and is visible in settings.

## Phase B — Rapid logger (search-first path)

Upgrade global search result rows (RUNWAY-CONTROLS Phase 3) with the archive flow:

1. TMDB result quick actions become: `Watching` (active-track) · `Seen it` (archive) · `+ Watchlist`.
2. Tapping **Seen it** inline-expands one compact row: sentiment chips `😍 Loved · 👍 Liked · 😐 Not for me` (tap one, row collapses, toast+undo) and a quiet "watched up to…" link for the rare partial case (deep-links to catch-up grid as an ACTIVE show).
3. The search overlay stays open after logging, input re-focused, so the loop is: type → tap → tap → type. A session counter quietly ticks in the overlay header ("12 added this session").
4. Keyboard: `S` = Seen it on highlighted row, then `1/2/3` = sentiment.

**Acceptance:** logging "The Wire — seen it, loved it" takes ≤4 interactions and ≤8 seconds; ten shows loggable in under two minutes by keyboard alone.

## Phase C — The Wall (the fun path; the signature of this brief)

A dedicated flow at `/history` ("Build your history"), linked from Library and shown as a dashboard prompt while the library is small:

1. **Tap-to-tick poster walls.** Dense grids (the RUNWAY-POP tile, 6–8 across) of curated candidates. Tap a poster once = Seen (tick overlay, `--new` green) · tap again = Loved (heart overlay, `--brand` red) · third tap clears. Long-press/right-click for Not for me. No dialogs, no navigation — pure tapping. Already-logged titles render dimmed with their mark.
2. **Curated walls, in tabs or stacked sections, sourced from TMDB (cached server-side):** Essentials of the 90s / 00s / 10s (top-rated TV by decade, en-language, vote_count floor) · Crime & prestige drama · Sci-fi & fantasy · Comedy · Films: modern classics by decade. Each wall ~24 titles, "Show more" extends.
3. **Momentum:** sticky session bar — "23 logged · keep going" with a subtle fill. On leaving, a summary toast: "31 shows added to your history."
4. Everything writes through the same actions layer (archive + sentiment), full undo per tap.
5. After a Wall session with ≥10 new sentiments, the dashboard's recommendation rail visibly refreshes ("Updated for your taste") — the immediate payoff that makes the effort feel worth it.

**Acceptance:** 50 shows loggable in ~10 minutes; every tap optimistic with undo; wall state survives refresh; no fabricated episode data anywhere.

## Phase D — The better story (taste-aware engine)

1. **Worth a look / START_FRESH reseeded from the taste profile:** TMDB recommendations seeded by loved+favourite titles (not just recently finished), scored against profile genres/keywords, filtered to Steve's providers (region=IE), excluding library and not_for_me-adjacent picks.
2. **Reasons become personal and specific:** every recommendation card's reason line names its anchor — "Because you loved The Sopranos" · "More spy drama, like Slow Horses" · "From the X-Files school". The anchor is the highest-weighted profile match, computed at rank time, never invented.
3. not_for_me actively suppresses: the title, and a mild negative weight on its dominant genre pairing.
4. New-season detection runs across ARCHIVE shows too: "The X-Files is back — you loved it. Rewatch or jump in?" → reactivation flow.
5. `/settings/taste`: the readable profile + a list of not_for_me suppressions with remove buttons. Nothing about the engine is a black box.

**Acceptance:** with ~30 sentiments seeded, Worth a look visibly reflects them, every card names a true anchor from Steve's history, and a not_for_me on a recommendation removes it and its near-neighbours on next refresh.

## Phase E — Library, grown up

1. Library tabs become: **Watching · Watchlist · History · Favourites** (History = finished + archive, the big shelf).
2. History tiles show sentiment glyph + era instead of progress; sort by sentiment, era, or title; filter chips by genre (from the profile data).
3. The History shelf gets a count in its header ("142 shows · 20 years") — the collection as a thing of pride; this is also the foundation the future Wrapped page reads from.
4. Search within Library respects tabs.

**Acceptance:** Sopranos sits in History with a loved mark and "00s" era; Shrinking sits in Watching with true progress; the two never cross streams.

---

## Guardrail amendments & notes

- Sentiment (3-level) is IN. Written reviews, 5/10-star scales, half-stars remain OUT.
- Favourite ≠ Loved: favourite is the scarce all-timer flag layered on top; the UI should never present both as one control.
- Archive completions never fabricate watch_events; any stats feature must treat archive and event-based history distinctly.
- The Wall's curated lists are cached TMDB queries — no hand-maintained title lists in code.
- Discovery/recommendation rails remain capped (two on the dashboard); taste makes them better, not more numerous.
