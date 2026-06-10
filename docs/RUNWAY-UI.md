# RUNWAY-UI.md — UI/UX Upgrade Brief

**Project:** Runway — private Ireland watch planner (TV/EPG, streaming, cinema releases, tracked shows, shared recommendation lists)
**Stack:** Next.js 15 (App Router), React 18, TypeScript, hand-rolled CSS (no Tailwind), lucide-react, Neon Postgres, TMDB API, EPG feed
**Routes:** `/` (home), `/login`, `/share/[slug]`, `/api/media-guide/*`

## How to use this brief

Work through the phases **in order**. Each phase is independently shippable and ends with acceptance criteria. Do not start a phase until the previous one's criteria pass. Before writing any code in a phase, read the relevant existing files end-to-end and summarise current state back to me — do not assume structure.

Maintain a `UI-NOTES.md` at repo root: after each phase, record what changed, decisions made, and anything deferred. Read it at the start of every session.

---

## Design direction (applies to every phase)

**Concept — "the departures board."** Runway is an aviation name; lean into it once, precisely. The signature element of this app is the **Tonight board**: TV listings rendered like an airport departures board — tabular, time-ordered, monospace flight-board typography, status chips (NOW BOARDING → ON NOW, SCHEDULED, TRACKED). Everything else in the app stays quiet and disciplined so this one element carries the identity.

**Palette (dark by default, no light mode):**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0D10` | App background (near-black, slightly blue) |
| `--surface` | `#14171C` | Cards, panels |
| `--surface-raised` | `#1B1F26` | Hover states, modals |
| `--line` | `#262B33` | Borders, dividers |
| `--text` | `#E8EAED` | Primary text |
| `--text-dim` | `#9AA0A8` | Secondary text, metadata |
| `--accent` | `#F5B82E` | Amber — departures-board signal colour. Tracked highlights, progress, active states |
| `--positive` | `#4ADE80` | "On now" only |
| `--danger` | `#F87171` | Destructive actions only |

Amber is the only personality colour. If a second accent feels needed, the answer is no.

**Type:** Body/UI: `Inter` (or system stack if avoiding a font dependency). Board/metadata/numbers: `IBM Plex Mono` — used for the Tonight board, episode codes (S03E07), times, countdowns, and runtimes. Two families total. Display sizing comes from weight + scale of Inter, not a third face.

**Spacing/radii:** 4px base scale (`--space-1` … `--space-8`). Two radii only: `--radius-sm: 6px` (chips, inputs), `--radius-md: 12px` (cards). Two shadows max.

**Motion rules:** 150–200ms ease-out for micro-interactions; one orchestrated moment max per view; every animation wrapped in `@media (prefers-reduced-motion: no-preference)`.

**Copy rules:** Sentence case everywhere. Buttons say what happens ("Mark watched", not "Submit"). Empty states direct action with one line of personality max — e.g. empty watchlist: "Runway clear. Search to add something."

---

## Phase 1 — Token audit & CSS normalisation

**Goal:** every visual value in the app flows from one token sheet.

1. Inventory all CSS files. List every hardcoded colour, font-size, spacing, radius, and shadow value with file/line references. Expect drift — this codebase was extracted from an earlier Media Guide project.
2. Create the `:root` token block (table above, plus a 7-step type scale `--fs-xs` … `--fs-3xl`, spacing scale, radii, shadows, and `--font-ui` / `--font-mono`).
3. Replace every hardcoded value with tokens. Collapse near-duplicate greys into the nearest token. Delete dead CSS.
4. Normalise interactive states: every clickable element gets consistent hover (`--surface-raised`), a visible `:focus-visible` ring (2px `--accent`, offset 2px), and `cursor: pointer`.
5. Watch CSS specificity: prefer single-class selectors; do not stack element+class selectors that fight each other on margins/padding.

**Acceptance:** grep for `#` hex values and `px` font sizes outside the token sheet returns ~zero; app is visually unchanged or subtly more consistent; keyboard tabbing shows a focus ring on everything interactive.

## Phase 2 — Artwork pipeline

**Goal:** TMDB imagery loads fast and looks intentional everywhere.

1. All TMDB images via `next/image` with `images.remotePatterns` for `image.tmdb.org`. Sizes: `w342` poster cards, `w185` list thumbnails, `w780` backdrops, `w1280` only for share-page headers.
2. Blur placeholders: a tiny utility that generates `blurDataURL` (or a 10px solid from the poster's dominant colour — see next point).
3. Dominant-colour extraction per title (server-side at save time, stored in the DB row — do not compute client-side per render). Use it as a 1px card border tint at ~25% opacity and as the blur placeholder colour. Subtle; if it's noticeable at a glance, dial it back.
4. Fallback card for missing artwork: `--surface` background, mono title, no broken images ever.

**Acceptance:** no layout shift on image load (fixed aspect-ratio boxes, 2:3 posters, 16:9 backdrops); Lighthouse image audits clean; offline/missing artwork degrades gracefully.

## Phase 3 — Information architecture: three views

**Goal:** collapse five concepts (TV, streaming, cinema, tracked, shared) into three top-level views. Preserve all data and API routes — this is a presentation-layer restructure.

- **Tonight** — the EPG view (Phase 4 makes it the signature).
- **Runway** — everything upcoming: cinema releases with countdowns, returning seasons of tracked shows, the watchlist. Sorted soonest-first.
- **Library** — tracked shows (in progress) and finished, with progress.

Navigation: slim top bar — wordmark left, three views centre, search right. On mobile (≤640px) the three views become a bottom tab bar. Shared lists remain reachable from Library (a "Shared lists" row), not top-level nav.

Add an **"Up next" rail** pinned to the top of Library (and optionally Tonight): one card per in-progress show = poster thumb, next episode code in mono (`S02E05`), episode title, single tap/click to mark watched with optimistic UI.

**Acceptance:** every feature reachable in ≤2 interactions from any view; no orphaned pages; mobile bottom nav works with safe-area insets.

## Phase 4 — The Tonight board (signature element)

**Goal:** the EPG rendered as a departures board. This is the one place to spend boldness.

1. Layout: a full-width table-like board, channels as rows or a single merged time-ordered list (judge based on how many channels the EPG feed carries — if >8 channels, group with a channel filter chip row). Columns: **time (mono, amber), channel, programme, status**.
2. Status chips (mono, uppercase, 11px): `ON NOW` (`--positive`), `NEXT`, `LATER` (`--text-dim`), and `TRACKED` (`--accent`, filled) when the programme matches a tracked show or watchlist item — this cross-reference is the app's killer feature; matching titles also get an amber left border on the row.
3. Matching logic: normalise titles (case, punctuation, leading "The") and match EPG programme names against tracked/watchlist titles; store confirmed matches so they're stable.
4. A "now" line: the board auto-scrolls to current time on load; a thin amber rule marks the current moment.
5. Orchestrated moment (the one per-view animation): on first load, rows cascade in with a 20ms stagger; respects reduced motion.
6. Optional flourish, only if cheap: tab-character flicker on the time column when the board refreshes, evoking split-flap. If it takes more than ~30 lines of CSS, skip it.

**Acceptance:** opening the app at 8pm answers "what's on tonight and is any of it mine?" in under 3 seconds with zero interaction; board is legible at 375px wide.

## Phase 5 — Runway view: countdowns

1. Cinema releases as 2:3 poster cards with a mono countdown chip (`12 DAYS`, amber at ≤7 days), sourced from TMDB release dates with `region=IE`. Group headers: "Out this week", "This month", "Coming up".
2. Returning seasons of tracked shows appear in the same stream (TMDB next-episode-to-air), visually identical cards with a `S04 · 12 DAYS` chip — one mental model for "things approaching".
3. Watchlist grid below: poster-dominant cards, title + year only, hover/long-press reveals actions (move to tracking, remove).

**Acceptance:** Runway view is one scrollable stream sorted by proximity; countdowns are correct against Irish release dates.

## Phase 6 — Library: progress & the episode grid

1. Show detail page: backdrop header (gradient overlay `--bg` 100% → 30%), poster, title, then a **season/episode grid** — one small square per episode (mono episode number), filled amber when watched. Tap toggles; "Mark season watched" per row. No checkbox lists.
2. Progress: thin 2px amber bar on Library cards; on detail, a mono summary line — `14/24 EPISODES · ~7H LEFT` (episode runtimes from TMDB).
3. All toggles optimistic: update UI instantly, sync to Neon in background, revert with a quiet toast on failure.
4. Completion moment: finishing the final episode of a series triggers a single subtle amber pulse on the progress bar — not confetti.

**Acceptance:** marking an episode watched feels instant (<50ms perceived); episode grid usable with thumb on mobile (min 32px touch targets).

## Phase 7 — Share pages (`/share/[slug]`)

The only public-facing surface — polish disproportionately.

1. Header: collage strip built from the list's top 4–5 backdrops with a dark gradient, list title large, item count + curator line in mono.
2. Each item: poster, title, year, one-line note if present, and **where-to-watch badges** from TMDB watch-providers (`region=IE`) — Netflix, Disney+, NOW, Prime, RTÉ Player etc. Small monochrome provider logos, amber on hover.
3. Dynamic OG image via `ImageResponse` (`opengraph-image.tsx`): dark card, 3 posters fanned, list title, "Runway" wordmark. Test the unfurl in WhatsApp — that's where these links get shared.
4. No login chrome, no app nav — a clean standalone page that loads fast.

**Acceptance:** share link unfurls with custom OG image; page scores ≥95 Lighthouse performance; looks intentional to someone who's never seen the app.

## Phase 8 — Motion & final polish

1. View Transitions API for poster → detail navigation (poster morphs into the detail header). Feature-detect; no polyfill.
2. Keyboard shortcuts (desktop): `/` focus search, `1/2/3` switch views, `Esc` close modals. Document them in a small `?` overlay.
3. Empty states for every list per the copy rules. Error states explain what happened and what to do.
4. Final pass: screenshot every view at 375px and 1280px; fix anything inconsistent against the token sheet. Apply the Chanel rule — find one decoration to remove.

**Acceptance:** reduced-motion users see no animation; all views audited at both widths; UI-NOTES.md updated with the full change log.

---

## Guardrails

- **Do not** add Tailwind, a component library, or a second icon set. lucide-react + tokens only.
- **Do not** touch the auth flow, API routes, or DB schema except the additive dominant-colour column in Phase 2.
- **Do not** add features beyond this brief (no ratings, reviews, tags, or settings page) — every addition is friction on a personal app.
- New dependencies require justification in UI-NOTES.md; target zero beyond a colour-extraction utility.
- Commit per phase with message `ui(phase-N): <summary>`.
