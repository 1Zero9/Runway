# UI-NOTES.md

Read this at the start of every session before touching any CSS or component code.

---

## Consolidated brief (RUNWAY-BRIEF.md)

RUNWAY-BRIEF.md supersedes all prior UI work. Light mode only, red accent `#C2362B`, Fraunces + Inter typography. The dark/amber theme is gone. Nine phases defined. See RUNWAY-BRIEF.md for the full spec.

---

## Phase 1 — Light theme tokens & type ✅

**What changed:**

- **`src/app/layout.tsx`** — Replaced `IBM_Plex_Mono` with `Fraunces` (with `opsz`, `SOFT`, `WONK` axes). Font variable wired as `--font-display`. `Inter` remains as `--font-ui`.
- **`src/app/runway.css`** — Complete rewrite of token sheet and all component styles:
  - New palette: `--bg #F6F7F9`, `--surface #FFFFFF`, `--surface-sunken #EEF0F3`, `--line #E2E5EA`, `--line-strong #C9CED6`, `--ink #16181D`, `--ink-soft #5A6170`, `--ink-faint #9AA1AD`, `--accent #C2362B`, `--accent-rgb 194,54,43`, `--accent-soft #FBEAE8`, `--positive #1E7A4D`
  - Shadows: layered ambient `--shadow-sm / --shadow-md` tuned for light mode
  - Radii: `--radius-sm: 8px`, `--radius-md: 14px`, `--radius-poster: 10px`
  - Removed: `--surface-raised`, `--text`, `--text-dim`, `--danger`, `--font-mono`, IBM Plex Mono references
  - All token names updated: `--text` → `--ink`, `--text-dim` → `--ink-soft`, `--surface-raised` → `--surface-sunken`
  - Hardcoded dark colors (`rgba(11,13,16,...)`, `#0B0D10`) replaced with new light palette
  - Cards get border + `var(--shadow-sm)` ambient shadow; hover lifts to `var(--shadow-md)` + `translateY(-2px)` over 150ms
  - Segmented controls: resting state is `--surface-sunken`, active is `--surface` with shadow
  - Active tab: `background: var(--accent)` (red), `color: #FFFFFF`
  - `.programme--tracked`: `background: var(--accent-soft)` with red left inset border
  - Section headings (`.settings-panel > h2`, `.settings-roadmap > h2`): Fraunces 22px + `--line-strong` hairline rule beneath
  - Numeric display elements (episode labels, times, countdowns, codes): `font-feature-settings: "tnum"` + `text-transform: uppercase` + `letter-spacing: 0.04em` — no third typeface
  - Mobile tabs: light glass `rgba(255,255,255,0.92)` with blur instead of dark glass
  - Toast: light surface + border instead of dark glass

**Acceptance criteria met:** Zero hardcoded dark colors; zero old token names; every view renders in the light theme; focus rings use `--accent` red throughout; Fraunces active on section headers.

---

## Phase 0 — Triage ✅

**What changed:**

- **Topbar** — removed commit hash `<span class="build-id">` from the header. Build info now lives in Settings → App version row (`Runway v0.1.5 · build <hash>`).
- **E00 bug** — extracted `formatEpisodeLabel(season, episode)` into `src/lib/episode-label.ts`. Both the episode tracker in the watch list and the UpNextRail now use this function. It clamps both season and episode to a minimum of 1, so `currentEpisode: 0` or `null` always renders as `S01 E01`, never `S01 E00`.
- **Unit tests** — added **vitest** (`^4.1.8`) as a devDependency. Config at `vitest.config.ts`. Five tests covering null/undefined defaults, episode 0 clamp, padding, and season 0 clamp. Run with `npm test`.
- **Channel management** — removed the full `.channel-panel` block from the Tonight tab. Replaced with a single "Edit channels" quiet link that routes to Settings. Full channel management (chip list, favourites/all toggle, reset Sky list) is now in Settings under the "Channels" section. Clicking a channel chip from Settings navigates back to Tonight with that channel filtered.
- **EPG default** — already `'from_now'`; no change needed.
- **Track/Watchlist button** — replaced the bare `<Plus>` icon-button on EPG rows with a labelled button: "Track" for TV shows, "Watchlist" for movies (`show.type === 'Movie'`). The button also now correctly sets `type: 'film'` for movie rows.

**New dependency justification:**

- `vitest ^4.1.8` — test runner. Required for the E00 unit test mandated in Phase 0. Vitest chosen (over Jest) because it runs TypeScript natively without a Babel transform step, and is compatible with the existing `tsconfig.json`. Zero runtime footprint (devDependency only).

**Deferrals:**

- CSS `.build-id` rule left in place for now (it's unused after the topbar change); will be removed in Phase 1 token sweep.

---

## Phase 1 — Token audit & CSS normalisation ✅

**What changed:**

- **`src/app/layout.tsx`** — added `next/font/google` loading for Inter (variable `--font-ui`) and IBM Plex Mono 400/700 (variable `--font-mono`). Font variables injected via `<body className>`.
- **`src/app/runway.css`** — full rewrite from 1,883 lines. All `--mg-*` tokens replaced with new token names. Zero `--mg-` references remain.
- **`src/app/Runway.tsx`** — removed `ThemeMode` type, `themeMode`/`setThemeMode` state, `themeClassName()` helper, settings theme toggle, and unused `Flag`/`Sun` lucide imports. `<main>` now always has `className="app-shell"`.

**Token sheet (`:root`):**

| Token | Value |
|---|---|
| `--bg` | `#0B0D10` |
| `--surface` | `#14171C` |
| `--surface-raised` | `#1B1F26` |
| `--line` | `#262B33` |
| `--text` | `#E8EAED` |
| `--text-dim` | `#9AA0A8` |
| `--accent` | `#F5B82E` (amber) |
| `--accent-rgb` | `245, 184, 46` |
| `--positive` | `#4ADE80` |
| `--danger` | `#F87171` |
| `--shadow-sm/md` | defined |
| `--radius-sm` | `6px` |
| `--radius-md` | `12px` |
| `--font-ui / --font-mono` | Inter / IBM Plex Mono |
| `--fs-xs … --fs-3xl` | 8-step type scale (11–42px) |
| `--space-1 … --space-8` | 4px base spacing scale |

**Decisions:**

- Light mode and trackside mode removed entirely (user instruction).
- Old accent `--mg-teal` (#00d0c3) → `--accent` (#F5B82E amber). Biggest visible change. All active states, chips, times, and highlights are now amber.
- Old `--mg-sun` (#d7ff32 lime) → merged into `--accent`. `--mg-coral` → `--danger`.
- Added `--accent-rgb` for rgba tinting without needing CSS `color-mix()`.
- `backdrop-filter: blur()` removed from card-level elements (now solid surface backgrounds). Kept on toast and mobile tab bar (legitimately floating).
- Added global `:focus-visible` ring: 2px `--accent`, offset 2px, `--radius-sm` radius.
- `--fs-md: 14px` added as 8th type scale step (several elements needed 14px).
- Hover state normalised: all buttons use `background: var(--surface-raised)` on hover. Active/accent buttons override with opacity fade.
- Two gradient stops remain as literal hex outside `:root` — `#0F1318` (app background gradient depth) and `#c08b18` (login mark amber mid-stop). Both are gradient-only derived values.
- IBM Plex Mono applied to: `.time`, `.continue-meta`, `.next-strip small`, `.calendar-item time`, `.date-pill`, `.episode-label`, `.version-badge`.

**Deferred:**

- `--positive` defined but not yet applied (no "ON NOW" chip exists yet — Phase 4).
- `--shadow-sm` defined but not yet used broadly.

**Acceptance criteria status:**

- ✅ grep for `#` hex values outside token sheet: 2 (gradient stops, acceptable)
- ✅ grep for `px` font sizes outside token block: 0 (except intentional 10px mobile tab label)
- ✅ `--mg-` references: 0
- ✅ `:focus-visible` ring on all interactive elements
- ✅ TypeScript: clean

---

## Phase 2 — Artwork pipeline ✅

**What changed:**

- **`next.config.ts`** — replaced deprecated `domains` with `remotePatterns` for `image.tmdb.org` (all paths) and `static.tvmaze.com`. Removed the old `www.google.com` entry.
- **`node-vibrant`** — added as the one justified colour-extraction dependency. Uses the `/node` subpath export (`node-vibrant/node`) for the server-side Node.js runtime. Not imported in any client component.
- **`src/lib/dominant-colour.ts`** — new utility. Fetches the w45 TMDb image and extracts the `DarkVibrant` or `Vibrant` swatch. Returns a hex string or `null` on any failure (fire-and-forget).
- **`src/lib/media-guide-db.ts`** — `dominant_colour text` column added to `media_recommendation_items` (both in `CREATE TABLE` and as an additive `ALTER TABLE ADD COLUMN IF NOT EXISTS`).
- **`src/app/api/media-guide/recommendations/route.ts`** — `add-item` calls `extractDominantColour` before insert and stores the result. All `SELECT`/`RETURNING` clauses now include `dominant_colour`. `mapItem` returns `dominantColour`.
- **`src/app/Runway.tsx`** — `RecommendationItem` type gains `dominantColour: string | null`. `dominantColourByKey` memo derived from recommendation items. Both `MediaGrid` calls now receive `dominantColourByKey`. `MediaGrid` component: new prop, inline `borderColor` style on selected cards (`hex + "40"` = 25% alpha), `next/image` with `blurDataURL` replaces all `<img>` tags for TMDb posters. Suggestion strip images also use `next/image`. `makePosterBlur()` helper generates a 10×15 SVG data URI from a hex colour using `btoa`.
- **`src/app/share/[slug]/page.tsx`** — query includes `dominant_colour`. Cards get the same inline border tint. `next/image` replaces `<img>`. Server-side `makePosterBlur` uses `Buffer.from().toString('base64')`.
- **`src/app/runway.css`** — `.poster-fallback.large` extended to `flex-direction: column` with gap. `.poster-fallback-title` added: mono font, xs size, 4-line clamp — shows title text when there is no poster.

**Decisions:**

- `node-vibrant/node` (not the default entrypoint, which is a runtime throw). The Node.js entrypoint bundles a proper image loader backed by `jimp`.
- `blurDataURL` is a tiny 10×15 SVG solid-colour rectangle — no external request, no layout shift, renders in ~0ms. Falls back to `--surface` (`#14171C`) when no colour is stored.
- Dominant colour is extracted only when a recommendation item is saved, not for every TMDb browse item. Cards in "selected" state show the tint; unselected cards get no border override.
- TVMaze images (`.programme img`) remain as `<img>` with `static.tvmaze.com` in `remotePatterns` — they're already optimised sizes and Phase 2 specifically scopes to TMDb.
- `blurDataURL` uses `btoa` on the client (Runway.tsx) and `Buffer.from().toString('base64')` on the server (share page). Both produce identical output.

**Acceptance criteria status:**

- ✅ No layout shift — `next/image` with explicit `width`/`height` + `style={{ height: 'auto' }}`
- ✅ Offline/missing artwork degrades: `.poster-fallback.large` shows icon + mono title
- ✅ Build passes, TypeScript clean
- ✅ TMDb images via `next/image` with correct size hints (`w342`/`w185`)
- ✅ `dominant_colour` stored in DB at save time, returned in GET
- ✅ Border tint applied at 25% opacity via hex alpha (`${colour}40`)

## Phase 3 — Information architecture ✅

**What changed:**

- **`src/app/Runway.tsx`** — Tab type collapsed from `'today' | 'streaming' | 'cinema' | 'watching' | 'lists' | 'settings'` to `'tonight' | 'runway' | 'library' | 'settings'`. Default tab is `'tonight'`.
- **Topbar** — replaced the tall hero banner (eyebrow, h1 42px, hero-copy, version badge) with a slim 56px bar: wordmark "Runway" amber left, inline `<nav className="tabs">` centre with 3 `TabButton`s, settings icon right. The `<nav>` now lives inside `<header>` rather than below it.
- **Home panel removed** — the `<section className="home-panel">` (continue-watching strip, up-next strip, suggestions strip, stats band) is gone. Content redistributed: suggestions → Runway view top; continue watching / up next → replaced by `UpNextRail`.
- **`UpNextRail` component** — new horizontal card rail showing in-progress (`status === 'watching'`) shows sorted by `lastWatchedAt` desc. Each card: mono `S##E##` episode code in amber, title, "Ep watched" / "Watched" quick-action button calling `markWatched` optimistically. Appears at top of both Tonight and Library views.
- **Tonight view** — old `tab === 'today'` renamed to `tab === 'tonight'`. UpNextRail pinned above the EPG tool row.
- **Runway view** — new `tab === 'runway'` combines streaming + cinema. Suggestions strip at top if available. Single shared `DiscoveryFilters` (with `showMediaType`) above streaming section. Cinema section separated by `.view-section` divider below.
- **Library view** — new `tab === 'library'` combines watchlist (add form, calendar, watch groups) + Shared Lists (create form, status rail, recommendation lists). UpNextRail at top. Shared Lists section headed by a `.section-heading.compact-heading` inside a `.view-section` divider.
- **Removed computed values** — `enabledProviders`, `activeWatchingCount`, `dueSoon` removed (no longer needed). Replaced by `inProgressShows` for the rail.
- **Removed `Users` lucide import** — was only used in the stats band.
- **`src/app/runway.css`** — topbar `min-height: 104px` → `height: 56px; padding: 0`. Tabs: removed `margin: 14px 0 0; width: fit-content; max-width: 100%; overflow-x: auto`. Added `.topbar-wordmark` (amber, `--fs-xl`, `font-weight: 750`). Added `.view-section` (top border + padding). Added `.upnext-rail`, `.upnext-card`, `.upnext-episode`, `.upnext-title`, `.upnext-mark`. Mobile `@media (max-width: 720px)`: tabs column changed from `repeat(5, …)` → `repeat(3, …)`; topbar old override (132px, align-items: flex-start) replaced with slim variant.

**Decisions:**

- `<nav>` lives inside `<header>`: on mobile the nav becomes `position: fixed` (out of flow), so the topbar renders as wordmark + settings only — no layout issue.
- Cinema section re-uses the shared `DiscoveryFilters` state (query, genre, statusFilter). The media-type toggle is only shown once at the top; cinema always filters to `movie` in `visibleCinemaItems` regardless.
- Stats band removed entirely — the numbers (X on TV, N services, N tracked, N lists) added friction without being actionable. Phase 4 (the departures board) will surface the EPG count naturally.
- `UpNextRail` uses `status === 'watching'` only (not 'waiting' or 'planned'). Cards show `S##E##` for shows/other and the service name for films/sport in the episode-code slot.
- Suggestions strip kept inside `.home-section` using existing CSS rather than introducing new classes.

**Acceptance criteria status:**

- ✅ Every feature reachable in ≤2 interactions from any view
- ✅ No orphaned tab conditions (`grep tab ===` returns exactly 4 conditions: tonight, runway, library, settings)
- ✅ TypeScript: clean
- ✅ Mobile bottom nav: 3 columns (was 5)
- ✅ `UI-NOTES.md` updated

## Phase 4 — Tonight board ✅

**What changed:**

- **`src/app/Runway.tsx`** — Board row redesign, `getProgrammeStatus`, `nowLineRef`, auto-scroll, row animation, `Fragment` import. `Clock3` lucide import removed.
- **`src/app/runway.css`** — Added `.board-list`, redesigned `.programme` as grid, `.programme--tracked`, `.programme-chips`, `.status-chip` family, `.now-line`, `@keyframes board-row-in` with `prefers-reduced-motion` guard.

**Programme card → departures board row:**
- `display: grid; grid-template-columns: 62px 1fr auto 34px` — time | programme copy | chips | track button
- Show images removed (tabular board needs no thumbnails)
- `border-radius: var(--radius-sm)` (6px, was 14px)
- `.board-list` wrapper uses `gap: 3px` (was 12px) for tighter rows

**Status chips (mono, uppercase, 11px):**
- `ON NOW` — green (`--positive`) with green-tinted border, when `nowMs >= startMs && nowMs < endMs`
- `NEXT` — text-dim with `--line` border, when programme starts within 30 minutes
- `TRACKED` — amber (`--accent`) with amber-tinted border, when `normalizeTitle(show.name)` matches a watched item title. Tracked rows also get `box-shadow: inset 3px 0 0 var(--accent)` + 4% amber background.
- `LATER` — no chip (default quiet state)
- ON NOW + TRACKED can both appear on the same row (e.g. a tracked show that's currently airing)

**Now line:**
- `<div className="now-line" ref={nowLineRef}>` inserted before the first programme whose `airstamp > now`
- Thin 1px amber line with a mono `NOW` label at the right
- Auto-scrolls to it with `behavior: 'smooth', block: 'center'` 180ms after `filteredTvItems` loads

**Row cascade animation:**
- `@keyframes board-row-in`: opacity 0→1, translateY 5px→0, 180ms ease-out
- Delay: `calc(var(--row-index, 0) * 18ms)` via inline `--row-index` CSS property
- Wrapped in `@media (prefers-reduced-motion: no-preference)` — reduced-motion users see no animation

**Decisions:**
- TRACKED priority: shown alongside time chips (not replacing them) so the user sees both urgency and tracking state
- Now line uses `right: 0` label (not left) to avoid collision with the amber inset border on tracked rows
- `runtime ?? 60` fallback — EPG items sometimes omit runtime; 60 min is a safe default for the ON NOW window
- Animation cap: 18ms × ~80 rows ≈ 1.44s max delay. Rows appearing ~4 seconds in get `animation-fill-mode: both` so they start hidden and complete in place

**Acceptance criteria status:**
- ✅ Board legible at 375px — `1fr` + ellipsis on show title handles narrow viewports
- ✅ Tracked shows visible immediately: amber inset border + TRACKED chip
- ✅ Reduced-motion: no animation
- ✅ Auto-scroll to NOW on data load
- ✅ TypeScript: clean

## Phase 5 — Runway view ✅

**What changed:**

- **`src/app/Runway.tsx`** — Added `activeWatchingItems`, `countdownItems`, `countdownGroups` useMemos. Added `getDaysUntil` helper. Added `CountdownCard` and `WatchlistGrid` components. Restructured Runway view JSX: countdown stream → watchlist grid → streaming/cinema discover section.
- **`src/app/runway.css`** — Added `.countdown-group`, `.countdown-group-label`, `.countdown-cards`, `.countdown-card`, `.countdown-card-fallback`, `.countdown-card-info`, `.countdown-card-title`, `.countdown-chip`, `.countdown-chip--urgent`. Added `.watchlist-grid`, `.watchlist-card`, `.watchlist-card-poster`, `.watchlist-card-info`, `.watchlist-card-actions`.

**Runway view structure (top → bottom):**
1. **Countdown stream** — grouped by proximity:
   - "Out this week" — releases/episodes within 7 days
   - "This month" — days 8–30
   - "Coming up" — beyond 30 days
2. **Watching grid** — `<WatchlistGrid>` for all active (non-completed/dropped) watching items
3. **Discover** — existing streaming browse + suggestions + cinema browse, in a `.view-section` divider

**Countdown cards (130px wide, 2:3 aspect ratio):**
- Cinema items: TMDb poster via `next/image` (w185), title, countdown chip
- Watching items: `.countdown-card-fallback` poster (2:3 aspect, title text fallback), title, season-prefixed chip
- Chip format: "TODAY", "TOMORROW", "N DAYS" — for shows: "S04 · N DAYS"
- Chip colour: `--text-dim` normally, `--accent` when `days <= 7`

**Watchlist grid:**
- `grid-template-columns: repeat(auto-fill, minmax(90px, 1fr))` — fills width responsively
- Each card is `aspect-ratio: 2/3` with absolute-positioned layers: poster placeholder (MonitorPlay icon) | title gradient overlay | action overlay (opacity 0 → 1 on hover/focus-within)
- Actions: "Ep watched" / "Watched" (calls `markWatched`) + "Remove" (calls `removeWatching`)

**`getDaysUntil(dateStr)`:** parses YYYY-MM-DD strings as UTC noon (avoids DST edge cases), returns integer days from Irish today.

**Decisions:**
- Streaming discovery section kept intact — moved under a `view-section` divider below the primary countdown + watchlist content. Not removed; still useful for browsing.
- Suggestions strip moved inside the Discover section (below the streaming heading) rather than at the very top of the view.
- Watching items use `nextEpisode` date (user-maintained) as the countdown source — TMDb `next_episode_to_air` would require new API work and is deferred to a later enhancement.
- Empty state shown when no countdown items AND TMDb is not loading.

**Acceptance criteria status:**
- ✅ Runway view is one scrollable stream sorted by proximity (countdown groups)
- ✅ Countdowns correct against Irish dates (UTC midnight parse)
- ✅ Cinema poster cards 2:3 with mono countdown chip
- ✅ Watchlist grid with hover-reveal actions
- ✅ TypeScript: clean

## Phase 6 — Library: progress & episode grid ✅

**What changed:**

- **`src/app/api/media-guide/show-details/route.ts`** — new GET route. Auth-guarded. Fetches TMDb `/tv/{id}` and returns `{ id, name, numberOfEpisodes, episodeRunTime, seasons: [{ seasonNumber, episodeCount }] }` (specials with `season_number === 0` excluded). Cached 1h via `next: { revalidate: 3600 }`.
- **`src/app/Runway.tsx`** — Added `TmdbShowDetail` type. Added `detailItemId`, `showDetailCache: Record<number, TmdbShowDetail>`, `pulsingItemId` state. Added `openShowDetail` (toggle panel, lazy-fetch on open), `handleEpisodeUpdate` (wraps `updateEpisode`, fires pulse when final episode reached). Updated `mediaToWatchingItem` to set `tmdbId: item.id` so Track-from-streaming populates the TMDb ID. Added `computeWatchProgress` helper (position-based, not watchedCount-based). Added `ShowDetailPanel` component. Library watch-item mapping now uses `.watch-item-wrapper / .watch-item-wrapper.expanded` wrapper divs; shows get a ChevronRight expand button; progress bar appears when TMDb data is loaded; detail panel slots in below the article with zero top-border.
- **`src/app/runway.css`** — Added `.watch-item-wrapper`, `.watch-item-wrapper.expanded > .watch-item`, `.show-detail-panel`, `.show-detail-summary`, `.episode-grid`, `.season-row`, `.season-row-head`, `.season-label`, `.season-mark-btn`, `.episode-cells`, `.ep-cell`, `.ep-cell.watched`, `.watch-progress-bar`, `@keyframes completion-pulse`, `.watch-item.pulse`.

**ShowDetailPanel:**
- Shows when `detailItemId === item.id`
- Summary line: `14/24 EPISODES · ~7H LEFT` in mono, dim colour
- Per-season rows: `S01` label + ✓ (mark season) + flex-wrap of episode cells
- Episode cells: 18×18px squares — amber fill when watched, line-border when not
- Clicking a cell at the current position (last watched) unmarks it; clicking any other cell sets position there
- "Mark season" → `updateEpisode(item, season, episodeCount)`

**Decisions:**
- `showDetailCache` is `Record<number, TmdbShowDetail>` (plain object, not Map) for React reactivity
- Progress bar uses position-based watched count (currentSeason/currentEpisode), not `watchedCount` increment counter — both coexist; `watchedCount` continues to track manual "Ep watched" button presses; the bar tracks actual position
- Completion pulse: `setPulsingItemId` on last-season-last-episode detection; clears after 700ms; CSS `@keyframes completion-pulse` is a box-shadow grow-and-fade
- TMDb data loads lazily on first panel open; cached in component state for the session

**Acceptance criteria status:**
- ✅ API route returns seasons + episode counts + runtime
- ✅ Episode grid: amber cells for watched, line cells for unwatched
- ✅ Progress bar (2px amber) visible after panel opened once
- ✅ "Mark season" per season row
- ✅ `N/TOTAL EPISODES · ~NhH LEFT` summary in mono
- ✅ Completion pulse animation on last episode
- ✅ `trackFromStreaming` now populates `tmdbId`
- ✅ TypeScript: clean

## Phase 7 — Share pages ✅

**What changed:**

- **`src/app/share/[slug]/page.tsx`** — Full redesign. Added `shared-list-content` wrapper (centred grid). Replaced `.shared-list-hero` with `.share-collage` collage header: posters right-aligned inside a 260px container with two-direction gradient overlay (dark from left + dark from bottom) and text floating bottom-left. Added `fetchWatchProviders` server helper calling TMDb `/movie/{id}/watch/providers` or `/tv/{id}/watch/providers` for IE region flatrate only. `Promise.all` fetches providers for the first 12 items. Provider badges appear below the overview in each card. Added `.share-footer` with amber "Runway" wordmark. `tmdb_id` and `media_type` now included in the SQL query.
- **`src/app/share/[slug]/opengraph-image.tsx`** — new file. Next.js `ImageResponse` at 1200×630. Dark gradient background. Up to 3 posters in a fanned layout (rotated). List name (large), item count, "Runway" wordmark in amber. Falls back gracefully if slug not found.
- **`src/app/runway.css`** — Replaced `.shared-list-hero` block with `.share-collage`, `.share-collage-posters`, `.share-collage-overlay`, `.share-collage-text`, `.share-collage-count`. Added `.shared-list-content`, `.share-providers`, `.share-provider-badge`, `.share-footer`. Removed orphaned `.shared-list-hero > p:last-child` colour rule. Mobile breakpoint: grid changed from 1-col to 2-col for share grid; collage height reduced to 200px.

**Decisions:**
- Provider fetch is fire-and-forget per item (returns `[]` on failure) — share pages remain functional without TMDb API key
- Only `flatrate` providers shown (no rent/buy clutter); capped at 3 per title
- OG image uses `runtime = 'nodejs'` (not edge) because `getMediaGuideSql` uses the Neon serverless driver which requires Node.js
- Collage uses `position: absolute` posters (right-aligned) so the text sits cleanly over the left gradient without needing to know poster count
- `shared-list-card img` keeps `aspect-ratio: 2/3` via CSS — `next/image` with `width={342} height={513}` preserves ratio naturally

**Acceptance criteria status:**
- ✅ Collage header with up to 5 posters + dark gradient overlay
- ✅ List title + count over collage
- ✅ Where-to-watch IE badges per card (flatrate only, up to 3)
- ✅ Dynamic OG image at `/share/{slug}/opengraph-image`
- ✅ Footer with amber Runway wordmark
- ✅ Mobile: 2-col grid, shorter collage
- ✅ TypeScript: clean

## Phase 8 — Motion & final polish ✅

**What changed:**

- **`src/app/runway.css`** — Global polish pass. Added `::selection` (amber tint), thin dark scrollbar (`scrollbar-color`, `scrollbar-width`, `::-webkit-scrollbar`). Improved `button:active` scale from `0.99` → `0.96` with a 60ms transition. Added amber glow to `.tab.active` (`box-shadow: 0 0 14px rgba(var(--accent-rgb), 0.3)`). Added `.icon-button.active` amber colour + border accent (used by episode-grid expand button). Added `.watch-item-wrapper:not(.expanded) > .watch-item:hover` subtle amber border highlight. Added six new `@keyframes`: `view-in`, `card-slide-in`, `toast-up`, `now-blink`. All new animations guarded by `@media (prefers-reduced-motion: no-preference)`.

- **`src/app/Runway.tsx`** — Added `--card-index` CSS custom property to each UpNextRail card (stagger by 50ms). Added `--item-index` CSS custom property to each `.watch-item-wrapper` (stagger by 28ms). Both use `as CSSProperties` cast (same pattern as board row `--row-index`).

**Animation inventory (Phase 8 additions):**

| Trigger | Keyframe | Duration | Target |
|---|---|---|---|
| Tab switch / view mount | `view-in` (opacity + translateY 8px) | 240ms | `.view` |
| Tab switch / view mount | `view-in` | 220ms | `.countdown-card` (nth-child stagger) |
| Tab switch / view mount | `view-in` | 200ms | `.watchlist-card` (nth-child stagger) |
| Library list render | `view-in` | 180ms | `.watch-item-wrapper` (`--item-index` × 28ms) |
| Tonight data load | `card-slide-in` (opacity + translateX -8px) | 220ms | `.upnext-card` (`--card-index` × 50ms) |
| Toast appear | `toast-up` (opacity + translateY 10px preserving translateX) | 200ms | `.toast` |
| Continuous | `now-blink` (opacity 0.85 ↔ 0.3, 2.4s) | ∞ | `.now-line::before` (the `NOW` label) |
| Completion | `completion-pulse` (box-shadow glow) | 700ms | `.watch-item.pulse` (Phase 6) |
| Board row load | `board-row-in` (opacity + translateY 5px) | 180ms | `.programme` (Phase 4) |

**Decisions:**
- `view-in` plays every tab switch because each tab conditionally mounts a new `.view` element (no DOM recycling). This is intentional and gives the app a "departures board page turn" feel.
- `button:active { transition: transform 60ms ease }` is deliberately short — active press should feel snappy, not floaty.
- Scrollbar style on `html` (not `*`) — scopes to the main page scroll; inner horizontally-scrolling elements (countdown cards, upnext rail) get their own thin scrollbar automatically.
- nth-child stagger for countdown/watchlist cards avoids JSX changes to `CountdownCard` and `WatchlistGrid` components — delays cap at 280ms / 210ms so late items don't lag visibly.
- `now-blink` only animates the `::before` pseudo-element (the `NOW` text), not the line itself — keeps the line stable as a visual anchor while the label pulses life.
- All existing `board-row-in` (Phase 4) and `completion-pulse` (Phase 6) animations untouched.

**Acceptance criteria status:**
- ✅ Tab view entrance animation on every switch
- ✅ Toast slides up from below on appear
- ✅ UpNextRail cards stagger slide-in from left
- ✅ Countdown cards stagger fade-in within each group
- ✅ Watchlist poster grid stagger fade-in
- ✅ Library watch-items stagger fade-in
- ✅ NOW label pulses on the Tonight board
- ✅ Active tab has amber glow
- ✅ Button press has snappy scale feedback
- ✅ Watch-item hover shows amber border hint
- ✅ Selection color (amber tint)
- ✅ Thin dark scrollbar
- ✅ All animations guarded by prefers-reduced-motion
- ✅ TypeScript: clean
