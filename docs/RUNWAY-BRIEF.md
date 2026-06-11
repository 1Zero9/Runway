# RUNWAY-BRIEF.md — The Decision Dashboard (Consolidated Brief)

**This is the single canonical brief. It supersedes RUNWAY-UI.md and RUNWAY-UI-V2.md — archive both.** Start UI-NOTES.md fresh with a "Consolidated brief" heading. Keep anything already built that serves this brief (token architecture, focus rings, next/image pipeline, optimistic updates); the dark theme, amber/mono styling, and departures-board concept are gone for good.

**Product thesis:** Runway is a personal decision dashboard. Steve opens it and, from his own watch history, it answers: *what should I watch tonight, with the time I've actually got?* Continue-watching with exact next episodes, shows nearly finished, things leaving soon, new and returning seasons with countdowns, and anything relevant on Irish TV tonight. The EPG and channel management still exist, but they serve the dashboard — they are not the dashboard.

**Three failure modes this brief is designed against** (keep these in mind on every phase):
1. **Logging friction** — personal trackers die when logging lapses and the data goes stale. Every logging action must be one or two taps; lapses must be repairable in seconds (reconciliation, catch-up gestures).
2. **Data trust** — the first wrong "Next: S02E05" kills belief in the dashboard. Sync plumbing, derivation tests, and persisted matches are premium features, not chores.
3. **Scope gravity** — everything on screen serves the tonight decision. Admin, debug, and full-day data dumps live elsewhere.

## How to use this brief

Work through phases **in order**; each is independently shippable with acceptance criteria. Before coding a phase, read the relevant existing files end-to-end and summarise current state — do not assume structure. Log every phase in `UI-NOTES.md` (decisions, deferrals); read it at the start of each session. Commit per phase: `runway(phase-N): <summary>`.

---

## Design direction (applies everywhere)

**Concept — "the beautifully typeset TV guide."** Print listings magazines were light, typographic, and scannable — and people circled what they planned to watch in red pen. Runway is that, modernised: a crisp editorial light interface where posters provide the colour, type provides the structure, and one red accent marks *your* picks, progress, and deadlines.

**Palette — cool gallery light, NOT cream/beige. Light mode only; no dark theme, no toggle.**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F6F7F9` | App background (cool light grey, never cream) |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--surface-sunken` | `#EEF0F3` | Inputs, wells, inactive chips |
| `--line` | `#E2E5EA` | Hairline borders, dividers |
| `--line-strong` | `#C9CED6` | Emphasised rules (section headers) |
| `--ink` | `#16181D` | Primary text — near-black, slightly cool |
| `--ink-soft` | `#5A6170` | Secondary text, metadata, reason lines |
| `--ink-faint` | `#9AA1AD` | Tertiary, timestamps, captions |
| `--accent` | `#C2362B` | Guide red. Progress, primary actions, urgent countdowns, "tracked" marks |
| `--accent-soft` | `#FBEAE8` | Red tint backgrounds (chips, highlights) |
| `--positive` | `#1E7A4D` | "On now", success toasts only |

The red is the **only** personality colour and must stay scarce — if a screen has more than a handful of red elements, the hierarchy has failed. Posters supply all other colour.

**Depth in light mode** (where light UIs go cheap — be precise): cards are `--surface` with a 1px `--line` border AND a soft ambient shadow `0 1px 2px rgb(22 24 29 / 0.04), 0 4px 12px rgb(22 24 29 / 0.06)`. Hover lifts to `0 2px 4px / 0.06, 0 8px 24px / 0.10` over 150ms. Never borders alone (wireframey) or heavy shadows (muddy).

**Type — editorial pairing via `next/font` (self-hosted, `display: swap`):**
- Display: **Fraunces** (fall back to Source Serif 4 if Fraunces feels too quirky in situ) — section headings, show titles on detail pages, the dashboard greeting. Large sizes, weight 550–650, tight tracking, used with restraint.
- UI/body: **Inter** — everything else.
- Numbers/codes (`S02E05`, `38 MIN`, `12 DAYS`): Inter with `font-feature-settings: "tnum"`, uppercase, letterspaced, `--ink-soft`. No third typeface.

Type scale: 12/13/14/16/18/22/28/36px. Section headers: Fraunces 22px with a `--line-strong` hairline rule beneath — a recurring structural device, like a magazine.

**Spacing/radii:** 4px scale. Radii: 8px (chips/inputs/buttons), 14px (cards), 10px (posters). Generous whitespace is the luxury signal — section padding 32–48px desktop, 20–24px mobile; never let two dense modules touch.

**Motion:** 150–200ms ease-out micro-interactions; one orchestrated moment per view max; everything inside `@media (prefers-reduced-motion: no-preference)`.

**Copy:** Sentence case. Buttons name the outcome ("Mark watched", "Track show"). Reason lines on cards are the product's voice — short, factual, personal: "3 episodes left", "New season started Friday", "Leaving Netflix in 6 days", "On BBC Two at 21:00".

---

## Phase 0 — Triage (do first, small and fast)

1. Remove the commit hash from the header — move build info to `/settings` footer if wanted.
2. Fix the `S01 E00` bug: next-episode derivation must never emit episode 0. If progress is empty, next = S01E01. Add a unit test.
3. Move the entire channel-management panel ("Your channel list", Add buttons, Reset starter Sky list) off the home page to `/settings/channels`. Home keeps at most one quiet "Edit channels" link.
4. EPG listings default to **"From now"**, not full-day-from-midnight. Full day stays as an option.
5. Clarify the listings "+" button: replace with labelled actions ("Track" for series, "Watchlist" for films), confirmed with a toast.

**Acceptance:** home page contains no admin UI, no debug strings, no 01:00 listings on first paint, no E00 anywhere.

## Phase 1 — Light theme tokens & type

1. Replace dark token values with the palette above in `:root`; remove the dark theme and any toggle entirely.
2. Install Fraunces + Inter via `next/font`; wire `--font-display`, `--font-ui`.
3. Re-skin all existing components from tokens only: card treatment (border + ambient shadow per spec), chips (`--surface-sunken` resting, `--accent-soft` + red text active), inputs, and the section-header style (Fraunces + hairline rule).
4. Interactive states everywhere: hover lift on cards, `--surface-sunken` hover on rows/chips, `:focus-visible` 2px `--accent` ring offset 2px.
5. Audit for dark-mode leftovers: grep old hex values; nothing dark-era survives.

**Acceptance:** zero hardcoded colours outside the token sheet; every view renders coherently in the new theme before any layout work; tabbing shows focus rings throughout.

## Phase 2 — Data model: watch history as the engine

Everything later depends on this being right. Additive migrations on Neon; do not break existing API routes.

1. **Tables (adapt names to existing schema conventions). Every table gets a `user_id` column defaulting to Steve's single user — costs nothing now, keeps the door open for sharing with others later. No other multi-user work.**
   - `shows` — tmdb_id, title, poster/backdrop paths, dominant colour, status (returning/ended/cancelled), next_air_date.
   - `show_providers` — show_id, provider (Disney+, Apple TV+, Netflix, NOW, Prime, RTÉ Player…), is_primary, **leaving_on (nullable date, manually set when Steve spots an expiry notice)**. Seed options from TMDB watch-providers `region=IE`; his chosen primary wins.
   - `episodes` — show_id, season, episode, title, air_date, runtime. Synced from TMDB; refresh on show open and via a daily cron for tracked shows.
   - `watch_events` — episode_id (or movie tmdb_id), watched_at, **source ('tap' | 'bulk' | 'reconcile')**. Append-only; progress is derived, enabling rewatch support and a future stats/Wrapped page.
   - `movies` — tmdb_id, title, artwork, ie_release_date, watched_at nullable, watchlisted_at.
2. **Derived per show (SQL views or query layer):** next unwatched episode, watched/total counts, **minutes remaining**, last_watched_at, is_caught_up, has_unwatched_new_season, days_until_leaving.
3. **Bulk progress write:** one operation for "watched up through S02E03" (insert watch_events for all episodes ≤ that point). Powers the catch-up UX in Phase 5 and reconciliation in Phase 6.
4. API routes for: log episode(s), unlog, set provider, set leaving date, and a **single aggregated dashboard query** returning derived progress across all tracked shows (no N+1).

**Acceptance:** can add Daredevil (Disney+) and Silo (Apple TV+), bulk-set "watched through S01", and one API call returns each show's exact next episode, remaining count, minutes left, and provider. Unit tests on next-episode derivation including specials (exclude season 0 from progress by default).

## Phase 3 — Artwork pipeline, light-mode treatment

1. All TMDB art via `next/image` (`image.tmdb.org` in remotePatterns): `w342` poster cards, `w185` thumbs, `w780` backdrops, `w1280` share headers. Fixed aspect-ratio containers (2:3, 16:9) — zero layout shift.
2. Posters sit on white cards with the standard border+shadow; on light backgrounds posters need no overlays — let them be saturated and crisp.
3. Backdrop headers (detail pages) get a **white** gradient scrim from the bottom (`--bg` 95% → transparent 40%) so ink text reads on them.
4. Dominant-colour extraction at save time, stored on the row; used only for blur placeholders and a barely-there top border tint on detail pages. Skip entirely if it ever fights the red accent.
5. Missing-art fallback: `--surface-sunken` card, Fraunces initial letter, title beneath. Never a broken image.

**Acceptance:** posters everywhere a title is referenced (dashboard, rails, lists, search results); no CLS; graceful fallbacks.

## Phase 4 — The Dashboard (signature view)

Home (`/`) becomes the decision dashboard. Order and content:

1. **Greeting + date** — Fraunces, e.g. "Thursday 11 June". Quiet, sets the editorial tone. No stats clutter.
2. **Time-fit chips (the decision input).** Directly under the greeting: `Anything · 30 min · 1 hour · Film night`. Selecting one re-ranks the Shortlist by fit against episode runtimes / film lengths ("1 hour" surfaces two ~30-min episodes or one drama episode; "Film night" surfaces watchlist films). Default "Anything"; selection is session-only, not persisted. This is the feature that makes Runway a decision engine rather than a tracker — keep it one tap, never a form.
3. **THE SHORTLIST (the signature element).** A single row of 3–5 large cards (~280px posters desktop, horizontal scroll-snap mobile) — the engine's best answers to "watch this tonight", per Phase 6. Each card: poster, title, provider badge, and a one-line **reason** in `--ink-soft` ("Next: S02E05 · 38 min", "Leaving Netflix in 6 days — 4 episodes left", "New season started Friday", "On BBC Two at 21:00"). Primary action on hover/tap: "Mark S02E05 watched" or "Start". One red detail max per card (progress hairline under the poster, or an urgent chip — never both).
4. **Reconciliation card (appears only when needed).** If any in-progress show has gone 7+ days without a logged watch, show one quiet card: "Catch me up — did you watch these?" listing the predicted next episodes with tap-to-confirm-all (bulk write, source='reconcile') or per-item confirm/dismiss. Ten seconds to repair a lapse; never nags more than once a week.
5. **Continue watching** — horizontal rail, in-progress shows by last-watched desc: small poster, next-ep code, thin red progress hairline, one-tap mark-watched (optimistic).
6. **Coming up** — countdown rail merging tracked-show season premieres (TMDB next-episode-to-air), watchlisted cinema releases (`region=IE`), **and leaving-soon deadlines**: poster + `12 DAYS` chip (`--surface-sunken` normally; `--accent-soft`/red when ≤7 days or any leaving-soon).
7. **On TV tonight** — ONLY EPG entries from now→midnight matching tracked/watchlist titles (normalised title matching; persist confirmed matches). Compact rows: time (tabular), channel, title, red "Tracked" mark. Empty state: "Nothing of yours on TV tonight." with a quiet link to the full guide. Never dump full listings here.
8. **Worth a look** — single row of TMDB recommendations seeded by the 3 most recently finished/highly engaged shows, filtered to Steve's providers, capped at 6. One-tap "Watchlist".

Layout: max-width ~1200px, generous gutters; Fraunces + hairline-rule section headers throughout. The dashboard renders from **one** aggregated server query.

**Acceptance:** dashboard answers "what should I watch tonight?" in <3s with zero interaction; time-fit chips visibly re-rank the Shortlist; every card explains *why* it's there; no spinner-then-pop (server-render, stream if needed); beautiful at 375px.

## Phase 5 — Show detail, episode grid & catch-up UX

1. Detail page: 16:9 backdrop with white scrim; poster overlapping it; Fraunces title; provider badge + status + next-air metadata + leaving date if set; progress sentence — "14 of 24 watched · about 7h left".
2. **Episode grid:** per season, a row of squares (min 36px touch targets), tabular episode numbers; watched = filled red, unwatched = `--surface-sunken` with `--line` border. Tap toggles (optimistic). Hover/long-press shows ep title + runtime. "Mark season watched" per row.
3. **Catch-up gesture (critical):** tapping any unwatched episode offers "Watched just this" / "Watched up to here" — the latter bulk-fills everything prior. Also surfaced during add-show flow: after tracking, immediately ask "Where are you up to?" with season chips + episode grid. Adding a half-watched show must take seconds.
4. **Leaving date:** a quiet "Leaving soon?" affordance on the provider badge opens a date field; feeds the `LEAVING_SOON` rule.
5. Movies detail: simpler — artwork, IE release countdown if unreleased, Watchlist/Watched toggles.
6. Completion: final episode logged → progress bar fills with a single red sweep; "Finished — nice one." toast; show moves to Library/Finished; engine may slot a related pick into Worth a look.

**Acceptance:** add Silo, declare "watched through S01E10" in ≤3 interactions; toggles feel instant (<50ms perceived) and revert quietly on sync failure; a leaving date set on detail appears in Coming up and the Shortlist.

## Phase 6 — Suggestions engine (deterministic, explainable)

Pure ranking rules in one tested module (`lib/shortlist.ts`) — no ML; every pick carries its reason string. Rule priority:

1. `LEAVING_SOON` — in-progress or watchlisted, leaving_on within 14 days → "Leaving Netflix in 6 days — 4 episodes left"
2. `FINISH_LINE` — in-progress, ≤3 episodes left → "3 episodes left — finish it"
3. `NEW_SEASON` — caught-up tracked show with unwatched new season airing/aired → "New season started Friday"
4. `CONTINUE` — in-progress, watched within 14 days, by recency → "Next: S02E05 · 38 min"
5. `ON_TV_TONIGHT` — tracked/watchlist title on EPG tonight → "On BBC Two at 21:00"
6. `STALLED` — in-progress, untouched 30+ days, max one per shortlist → "Still going? Last watched in May"
7. `START_FRESH` — watchlist item available on Steve's providers, max one → "On your list · Apple TV+"

Composition: top 5 by rule priority then recency; max two cards per rule; stable ordering within a day (no shuffling on refresh). **Time-fit filter applies after ranking:** given the selected chip, drop/demote picks whose next unit doesn't fit the window (30 min → next episode ≤35 min; 1 hour → ≤70 min or two short episodes; Film night → films and feature-length episodes first). Pure functions over Phase 2 derived data; unit tests for every rule, the composition, and each time-fit window.

**Acceptance:** given seeded fixtures, the shortlist is predictable and fully tested; every dashboard card's reason matches its rule; time-fit selections produce correct, tested re-rankings.

## Phase 7 — TV guide & settings, relegated and refined

1. `/guide`: the full EPG in the editorial style — "From now" default, channel filter as quiet chips, tabular time figures, tracked matches marked in red. Date picker tucked right. Labelled Track/Watchlist actions (no bare "+").
2. `/settings/channels`: the favourites manager moved here, searchable, grouped by provider.
3. `/settings`: provider preferences (which services Steve subscribes to — feeds Worth a look and START_FRESH filtering), data refresh status, build info.
4. Nav stays three items — Tonight (dashboard) / Runway (coming up, full view) / Library — with Guide and Settings as quiet icons right of the bar.

**Acceptance:** guide is pleasant but clearly secondary; channel admin unreachable from the dashboard except via settings.

## Phase 8 — Reach beyond the app: calendar & digest

The dashboard works when opened; this phase makes Runway useful without opening it.

1. **ICS calendar feed.** A token-protected route (`/api/calendar/[token].ics`) emitting VEVENTs for: tracked-show season premieres and next-episode air dates, watchlisted Irish cinema releases, and leaving-soon deadlines. Subscribe once in Google/Apple Calendar; regenerateable token in settings. All-day events, clean titles ("Severance S03 premieres · Apple TV+"), no descriptions bloat.
2. **Sunday "week ahead" digest (optional — skip if email infra feels heavy).** A weekly email: what premieres this week, tracked titles on TV worth recording, what you're close to finishing, anything leaving. Reuses the Phase 6 engine output; plain, typographic, matches the app's editorial voice. Use Resend (or similar single-purpose sender) via a Vercel cron; one new dependency, justified in UI-NOTES.md. If skipped, render the same "Week ahead" as a dashboard section toggleable from settings instead.

**Acceptance:** calendar feed validates and subscribes cleanly in Google Calendar and Apple Calendar; events appear/disappear as tracking changes; digest (if built) sends via cron with correct content and an unsubscribe/disable setting.

## Phase 9 — Polish pass

1. View Transitions API: poster morphs from card to detail header (feature-detected, no polyfill).
2. Keyboard: `/` search, `1/2/3` views, `g` guide, `Esc` closes; `?` overlay documents them.
3. Empty states per copy rules — new-user dashboard becomes simple onboarding: "Track your first show" with an inline search field.
4. Error states say what happened and what to do; no bare failures.
5. Screenshot audit of every view at 375px and 1280px against the token sheet; fix drift. Then the subtraction pass: find at least one decoration per view to remove.
6. Update UI-NOTES.md with the complete change log.

**Acceptance:** reduced-motion clean; both widths audited; a stranger seeing the dashboard would assume a designed product.

---

## Deferred (deliberately not in this brief)

- **Stats / year-in-review ("Wrapped") page** — the append-only `watch_events` model already supports it; build as its own small brief once ~6 months of data exists.
- **Multi-user / accounts** — the `user_id` columns and middleware abstraction are the entire allowance. No registration, no profiles, no permissions. If others ever join, it'll be via the share pages proving the product first. (Note for that future, not now: EPG redistribution rights and TMDB's non-commercial terms become real conversations beyond personal use.)
- **Scrobbling / automatic detection** — not feasible without media-server integration; the reconciliation card is the answer to logging lapses instead.

## Guardrails

- No Tailwind, no component libraries, no second icon set (lucide-react only), no dark mode, no theme toggle.
- No features beyond this brief: no ratings, reviews, tags, or social.
- Schema changes additive only; never break `/api/media-guide/*` consumers mid-phase.
- New dependencies need a UI-NOTES.md justification; expected total: fonts, a colour-extraction utility, an ICS builder (or hand-rolled — ICS is simple text), and Resend only if Phase 8.2 is built.
- The red accent budget: adding a red element means demoting an existing one.
- Every phase ends with the three failure modes re-checked: is logging still effortless, is the data still trustworthy, has anything crept onto the dashboard that doesn't serve tonight's decision?
