# UI-NOTES.md

Read this at the start of every session before touching any CSS or component code.

---

## Consolidated brief (RUNWAY-BRIEF.md)

RUNWAY-BRIEF.md supersedes all prior UI work. Light mode only, red accent `#C2362B`, Fraunces + Inter typography. The dark/amber theme is gone. Nine phases defined. See RUNWAY-BRIEF.md for the full spec.

---

## Phase 4 — The Dashboard ✅

**What changed:**

**Tab restructure:**
- `Tab` type extended: `'tonight' | 'runway' | 'library' | 'settings' | 'guide'`
- `tonight` tab → decision dashboard (8 sections per brief)
- EPG full guide moved to new `guide` tab, accessible via Tv icon in topbar
- `Tv` tab icon replaced with `LayoutDashboard` for the Dashboard tab
- Topbar now has `topbar-actions` group (Guide icon + Settings icon as quiet right-side icons)
- `icon-button.active-icon` shows `--accent` highlight when the corresponding tab is active

**New state:**
- `timeFit: TimeFit` — session-only, default `'any'`
- `reconDismissed: boolean` — session-only, dismisses reconciliation card for the session

**New computed:**
- `shortlistItems` — `deriveShortlist(watching, timeFit)`, max 5 entries
- `tvTonightTracked` — today's EPG filtered to `trackedTitleSet`, from now → midnight, max 8
- `reconItems` — `inProgressShows` where `lastWatchedAt` is >7 days ago or null (zeroed when dismissed)

**Dashboard sections (in order):**
1. **Greeting** — Fraunces `--fs-3xl` with `formatGreeting(now)` (e.g. "Thursday 11 June")
2. **Time-fit chips** — `Anything / 30 min / 1 hour / Film night`; active state uses `--accent-soft` + `--accent` border/text; session-only
3. **Shortlist** — `ShortlistCard` components; Fraunces section header + hairline rule; horizontal scroll-snap rail; each card: poster, service label, title, reason line, red action button
4. **Reconciliation** — `ReconciliationCard` appears when `reconItems.length > 0`; lists up to 4 stale shows; per-item "Watched" confirm; dismiss × button sets `reconDismissed = true`
5. **Continue watching** — `ContinueRail`; small posters with 3px red progress hairline at bottom; next-ep label; "Ep watched" / "Watched" button
6. **Coming up** — existing countdown groups reused in dashboard
7. **On TV tonight** — compact rows (time, channel at ≥640px, title, chips); empty state with "Full guide →" quiet-link to guide tab
8. **Worth a look** — existing suggestion strip reused in dashboard

**New pure functions:**
- `deriveShortlist(items, timeFit)` — priority rules: CONTINUE recent (≤14 days) → CONTINUE older (≤30 days) → STALLED → WAITING → PLANNED; time-fit 'film' filters to `type === 'film'` first; '30min'/'1hour' deprioritize films by +15 priority; fallback to full pool when film filter yields empty
- `formatGreeting(date)` — `Intl.DateTimeFormat` `weekday: long, day: numeric, month: long`

**New components:**
- `ShortlistCard` — 200/240/280px wide (mobile/tablet/desktop); 2:3 poster; red action button; progress hairline when `showDetail` available from `showDetailCache`
- `ContinueRail` — horizontal scroll; 110/130/150px wide cards; 3px red progress track
- `ReconciliationCard` — quiet surface card; per-row confirm buttons

**CSS additions:**
- `.dashboard`, `.dashboard-greeting`, `.greeting-date`
- `.time-fit-bar`, `.time-fit-chip`, `.time-fit-chip.active`
- `.dashboard-section`, `.dashboard-section-header` (Fraunces 22px + hairline rule)
- `.shortlist-rail`, `.shortlist-card`, `.shortlist-progress-track/fill`, `.shortlist-card-info/service/title/reason/action`
- `.continue-rail`, `.continue-card`, `.continue-card-poster/progress-track/fill/info/ep/title/mark`
- `.recon-card`, `.recon-card-header/label`, `.recon-list`, `.recon-row/info/title/ep`, `.recon-confirm`
- `.tv-tonight-list/row/time/channel/title/chips/empty`, `.quiet-link`
- `.topbar-actions`, `.icon-button.active-icon`
- Responsive breakpoints at 640px (channel column + wider cards) and 1024px (wider gutters + 280px shortlist cards)

**Auto-scroll to now-line:** moved from `tab === 'tonight'` to `tab === 'guide'` guard.

**Failure mode audit:**
- Logging still effortless: "Ep watched" one-tap in Continue rail; Reconciliation card repairs lapses in one pass.
- Data still trustworthy: shortlist is derived purely from existing `watching` state; no new sync paths.
- Dashboard serves tonight's decision: all 8 sections exist to answer "what should I watch?" — nothing else visible.

---

## Phase 3 — Artwork pipeline ✅

**What changed:**

**DB migration (additive):**
- `media_watchlist` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS poster_path text`. All existing rows get `null`; new rows populated at track time.

**API changes:**
- `watchlist/route.ts` — `poster_path` added to SELECT (GET), INSERT + RETURNING (POST), RETURNING (PATCH). Added `posterPath?: string | null` to `WatchlistPayload`. `mapRow` now returns `posterPath`. DB migration added to `ensureTable`.
- `shows/route.ts` — imports `extractDominantColour`. After upsert, launches non-blocking `extractDominantColour(tmdb.poster_path)` and writes the result to `runway_shows.dominant_colour`. Same fire-and-forget pattern as `syncEpisodes`.

**`Runway.tsx` changes:**
- `WatchingItem` — added `posterPath?: string | null` field.
- `mediaToWatchingItem` — maps `item.poster_path` to `posterPath` so tracking from browse strips persists the poster.
- `countdownItems` — watchItems now pass `posterPath: i.posterPath ?? null` (was hardcoded `null as null`).
- `makePosterBlur` — fallback colour changed from dark `#14171C` to light `#EEF0F3` (matches `--surface-sunken`).
- `WatchlistGrid` — replaced `<MonitorPlay size={20} />` with `<Image>` (w185 size) + `poster-fallback-initial` Fraunces letter fallback.
- `MediaGrid` (streaming grid) — replaced `<MonitorPlay size={28} />` fallback with Fraunces initial letter.
- Suggestion strip — replaced `<MonitorPlay size={18} />` fallback with Fraunces initial letter.
- `CountdownCard` — removed `borderColor: ${dominantColour}40` inline style (brief: only keep colour for blur placeholders).
- `MediaGrid` — removed `borderColor: ${dominantColour}40` card border.
- `dominantColour` variable kept for `blurDataURL` in `MediaGrid`; `dominantColourByKey` prop retained.

**`runway.css` changes:**
- Added `.poster-fallback-initial` — Fraunces, 18px, `--ink-faint`, `user-select: none`.
- Added `.poster-fallback.large .poster-fallback-initial` — `--fs-3xl` (28–36px) for the large card fallback.

**Failure mode audit:**
- Logging still effortless: track buttons work, poster persists automatically from `mediaToWatchingItem`.
- Data still trustworthy: poster_path stored once at track time; DB migration additive; all existing items get `null` posterPath and show Fraunces initial.
- Dashboard still clean: removed colour borders don't affect layout; blur placeholders remain for images.

---

## Phase 2 — Data model: watch history as the engine ✅

**What changed:**

**New pure functions (fully unit-tested):**
- `src/lib/next-episode.ts` — `deriveNextEpisode(episodes, watchedIds)` and `deriveMinutesRemaining(episodes, watchedIds)`. Season 0 specials excluded by design. 11 unit tests covering: default next ep, all-watched null, specials exclusion, skip-watched, season advance, unsorted input, empty list, minutes-remaining sum, and null-runtime handling.

**New schema (5 tables — additive, no existing tables modified):**
- `runway_shows` — tmdb_id, title, poster/backdrop paths, dominant_colour, status, next_air_date. Unique on (user_id, tmdb_id).
- `runway_show_providers` — show_id FK, provider_name, is_primary, leaving_on (nullable). Unique on (show_id, provider_name).
- `runway_episodes` — show_id FK, season, episode, title, air_date, runtime. Unique on (show_id, season, episode). Upsert-safe for re-sync.
- `runway_watch_events` — episode_id FK, user_id, watched_at, source ('tap'|'bulk'|'reconcile'). Append-only; no unique constraint (rewatches allowed).
- `runway_movies` — tmdb_id, title, artwork, ie_release_date, watched_at, watchlisted_at.

All tables get `user_id` defaulting to 'steve' via `RUNWAY_USER_ID` constant.

**New API routes:**
- `GET/POST/DELETE /api/media-guide/shows` — track/list/remove shows. POST fetches TMDb `/tv/{id}` + syncs all season episodes via parallel `/tv/{id}/season/{n}` calls (non-blocking background sync, errors suppressed per-season).
- `POST /api/media-guide/watch-events` — log single tap (`mode:'tap', episodeId`) or bulk range (`mode:'bulk', showId, targetSeason, targetEpisode`). Bulk write skips already-watched episodes.
- `DELETE /api/media-guide/watch-events?episodeId=...` — removes most recent watch event (unlog).
- `GET/PATCH/DELETE /api/media-guide/show-providers` — set/update/remove provider + leaving_on date. PATCH demotes other providers when `isPrimary:true`.
- `GET /api/media-guide/dashboard` — single CTE aggregated query with CTEs: `watched_eps`, `show_progress`, `next_unwatched`, `primary_provider`. Returns watched_count, total_episodes, minutes_remaining, last_watched_at, next episode fields, provider, days_until_leaving, is_caught_up. No N+1.

**Existing API routes:** untouched. `media_watchlist` and `media_recommendation_*` tables unchanged.

**Deferrals:**
- `has_unwatched_new_season` derived flag — deferred to Phase 6 suggestions engine where it's first consumed.
- Movie watchlist UI — deferred to Phase 5.
- Episode sync cron job — deferred to Phase 7/8.

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

---

## Phase 5 — Leaving dates + catch-up gesture ✅

**What changed:**

- `WatchingItem` extended with `leavingDate?: string | null`
- `WatchlistRow` / `WatchlistPayload` in `/api/media-guide/watchlist/route.ts` include `leaving_date`
- `ensureTable` adds `alter table … add column if not exists leaving_date date`
- PATCH route uses a separate conditional UPDATE to set `leaving_date = null` correctly (COALESCE can't clear to NULL)
- `updateLeavingDate(item, date)` — optimistic update + PATCH call in `Runway.tsx`
- `ShowDetailPanel` rewritten with:
  - `pendingCatchup` state — tap an unwatched episode to show a confirmation bar
  - `editingLeaving` state — inline date input via `LeavingDateRow`
  - `show-detail-meta` row — episode count + remaining label + leaving chip
  - Catch-up bar shows "Watched up to here" (bulk mark) and "Just this episode" actions
- `LeavingDateRow` component: leaving chip (red when ≤7 days) → edit mode with date input
- `handleEpisodeUpdate` detects last episode → calls `updateWatchingStatus('completed')` + toast
- `onUpdateLeavingDate` prop threaded through to `ShowDetailPanel` from `ShortlistCard` and parent

**New CSS classes:** `.show-detail-meta`, `.show-detail-leaving`, `.leaving-chip`, `.leaving-chip.urgent`, `.leaving-edit`, `.leaving-date-input`, `.ep-catchup-bar`, `.ep-catchup-label`, `.ep-catchup-btn`, `.ep-catchup-btn.secondary`, `.ep-catchup-dismiss`

**Acceptance criteria status:**
- ✅ Leaving date visible in show detail panel
- ✅ Chip turns red when ≤7 days remain
- ✅ Date editable inline with date input
- ✅ Clearing the date works (null PATCH)
- ✅ Catch-up gesture shows confirmation bar for non-next-episode taps
- ✅ Finishing last episode auto-completes the show
- ✅ TypeScript: clean

---

## Phase 6 — Shortlist engine ✅

**What changed:**

- `src/lib/shortlist.ts` — new pure `buildShortlist(items, context, timeFit)` function
  - 7 rules: LEAVING_SOON (≤14 days), FINISH_LINE (≤3 eps left), NEW_SEASON, CONTINUE (≤14 days), ON_TV_TONIGHT, STALLED (30+ days), START_FRESH
  - Priority: LEAVING_SOON=1 … START_FRESH=7; max 2 cards per rule; returns top 5
  - `timeFit` filter: film night, 30min (≤35min avgRuntime), 1hour (≤70min)
  - Accepts `EpisodeCounts` map (watched/total/avgRuntime keyed by item id)
  - Accepts `tvTonightTitles` Set for ON_TV_TONIGHT; `userProviders` array for START_FRESH filtering
- `src/lib/__tests__/shortlist.test.ts` — 40 tests covering all rules + composition + time-fit
- `Runway.tsx` — `deriveShortlist` replaced with `buildShortlist`; shortlistItems memo now receives:
  - `today` from `formatIrelandDate(now)`
  - `tvTonightTitles` from `tvTonightTracked` show names
  - `episodeCounts` built from `showDetailCache` (watched count computed from season/episode position)
  - `userProviders` from enabled providers flatMap of match arrays

**Acceptance criteria status:**
- ✅ 40 tests pass (`npm test`)
- ✅ TypeScript: clean
- ✅ ON_TV_TONIGHT wired to live EPG data
- ✅ FINISH_LINE / episode counts wired to TMDb show detail cache
- ✅ START_FRESH filters by enabled streaming services

---

## Phase 7 — Guide & Settings refinement ✅

**What changed:**

- Guide tab: channel `<select>` dropdown replaced with scrollable quiet chip strip (`.guide-channel-bar`)
  - "Favourites" / "All" chip clears channel filter; per-channel chips toggle single-channel view
  - Settings gear icon at end of chip bar — quick link to channel settings
  - Sport / From now / Full day controls moved to a right-aligned row next to search
  - Date picker tucked to the right
- Settings tab: new "Streaming Services" section with toggle chips for enabled providers (`.provider-settings-chip`)
  - These feed directly into `buildShortlist` `userProviders` context for START_FRESH filtering

**New CSS classes:** `.guide-tool-row`, `.guide-tool-right`, `.guide-date-field`, `.guide-channel-bar`, `.guide-channel-chip`, `.guide-channel-chip.active`, `.guide-channel-settings`, `.settings-help`, `.provider-settings-row`, `.provider-settings-chip`, `.provider-settings-chip.active`

**Acceptance criteria status:**
- ✅ Channel filter is chips not dropdown
- ✅ Guide is pleasant but clearly secondary to the dashboard
- ✅ Provider preferences in Settings
- ✅ TypeScript: clean

---

## Phase 8 — Calendar feed ✅

**What changed:**

- `src/app/api/calendar/token/route.ts` — GET returns current token, POST generates/regenerates a new one
  - Creates `runway_calendar_tokens` table (user_id PK, token, created_at)
  - Protected by `hasMediaGuideSession()`
- `src/app/api/calendar/[token]/route.ts` — public ICS endpoint
  - Validates token against `runway_calendar_tokens`; returns 404 for invalid tokens
  - Emits VEVENTs for: next episode air dates, film release dates, leaving-soon deadlines
  - RFC 5545 compliant: all-day events (DATE not DATETIME), line folding at 75 octets, ICS escaping
- `Runway.tsx` — calendar section in Settings:
  - `calendarToken` state, fetched on mount
  - `generateCalendarToken()` function calls POST, updates state
  - Settings shows: full URL in `<code>`, Copy URL button, Regenerate button
  - Uses existing `ep-catchup-btn` / `Copy` / `RefreshCw` / `CalendarDays` icons (no new imports)

**New CSS classes:** `.calendar-feed-row`, `.calendar-url-display`, `.calendar-feed-actions`

**Acceptance criteria status:**
- ✅ Token generation works
- ✅ ICS route returns valid calendar format
- ✅ Events include next-episode dates, film releases, leaving-soon alerts
- ✅ Token-protected (404 on invalid token)
- ✅ Copy URL to clipboard in Settings
- ✅ Regenerate invalidates old URL
- ✅ TypeScript: clean

---

## Phase 9 — Polish pass ✅

**What changed:**

- Keyboard shortcuts (global `keydown` listener):
  - `1/2/3` → Dashboard / Runway / Library tabs
  - `g` → Guide tab
  - `Esc` → close keyboard overlay; then close detail panel
  - `?` → toggle keyboard shortcut overlay
  - Listener ignores input/textarea/select focus
- Keyboard overlay: modal with `<kbd>` chips, click-outside to dismiss
- Onboarding empty state: when shortlist is empty, show "Track your first show" card with inline search form — on submit, pre-fills the discovery query and navigates to the Runway tab
- TypeScript fix: `showDetail!.seasons.find(…)` in hoisted function declaration

**New CSS classes:** `.keyboard-overlay`, `.keyboard-overlay-panel`, `.keyboard-overlay-title`, `.keyboard-shortcut-list`, `kbd`, `.keyboard-overlay-close`, `.onboarding-card`, `.onboarding-search`

**Acceptance criteria status:**
- ✅ Keyboard shortcuts work without focus trap
- ✅ `?` overlay documents shortcuts
- ✅ New-user empty state shows inline search
- ✅ 40 tests pass
- ✅ TypeScript: clean

---

## UI-NOTES.md Phase 6 (Library backdrop & progress) ✅

**Adapted from RUNWAY-UI.md Phase 6 — Library: progress & episode grid**

**What changed:**

- `TmdbShowDetail` type extended with `backdropPath?: string | null`
- `show-details` API route: added `backdrop_path` to TMDb response type, maps to `backdropPath` in JSON response
- `ShowDetailPanel` gets a backdrop header when `showDetail.backdropPath` is present:
  - `w780` TMDb backdrop image fills a 140px-tall strip at the top of the panel
  - Gradient overlay (`--surface` 100% → transparent) from bottom
  - Small poster thumbnail + title overlaid at bottom-left
  - The title `<h3>` receives `view-transition-name: 'detail-title'` for the morph (see Phase 8)
- Library list items already had `.watch-progress-bar` (2px accent-filled strip) — confirmed working; no changes needed

**New CSS classes:** `.show-detail-backdrop`, `.show-detail-backdrop-overlay`, `.show-detail-backdrop-title`

---

## UI-NOTES.md Phase 7 (Share page light-mode refresh) ✅

**Adapted from RUNWAY-UI.md Phase 7 — Share pages**

**What changed:**

- `opengraph-image.tsx`: updated OG image to light-mode palette:
  - Background: `linear-gradient(145deg, #FFFFFF, #F6F7F9)` (matches `--surface` → `--bg`)
  - Title/text: `#16181D` (matches `--ink`)
  - Poster border accent: `rgba(194,54,43,0.18)` (matches `--accent` / `#C2362B`)
  - Box shadow: `rgba(0,0,0,0.14)` (lighter than dark-mode version)
  - "Runway" wordmark: `#C2362B` (red accent)
  - Secondary text: `#6B7280` (matches `--ink-soft` approximation)
- `share/[slug]/page.tsx`: `makePosterBlur` fallback color changed from `#14171C` (dark) to `#EEF0F3` (light, matches `--surface-sunken`)
- Share card `border-radius` reduced from hard-coded `22px` to `var(--radius-md)` (Chanel rule — one decoration removed)

---

## UI-NOTES.md Phase 8 (View Transitions + final polish) ✅

**Adapted from RUNWAY-UI.md Phase 8 — Motion & final polish**

**What changed:**

- `flushSync` imported from `react-dom`
- `transitioningItemId` state added — tracks which item is mid-transition
- `openShowDetail` updated to use `document.startViewTransition` (feature-detected):
  1. `flushSync(() => setTransitioningItemId(item.id))` — sync render gives the source title `view-transition-name: 'detail-title'`
  2. `document.startViewTransition(() => flushSync(doOpen))` — browser captures old state, callback opens the detail (new state has backdrop title with same VT name)
  3. Browser morphs the title between its old and new positions
- Library row `<h2>` gets `viewTransitionName: 'detail-title'` when `transitioningItemId === item.id`
- ShowDetailPanel backdrop title `<h3>` has `viewTransitionName: 'detail-title'` always (only present when detail is open, so no duplicate-name conflict)
- View Transitions CSS: `@supports (view-transition-name: test)` guard; custom `vt-title-out` / `vt-title-in` keyframes (200–240ms ease-out fade+translate); `prefers-reduced-motion` disables animation
- Token sweep: no hardcoded dark-mode hex values remaining in CSS, Runway.tsx, or share pages

**New CSS:** `.show-detail-backdrop` family, `@keyframes vt-title-out`, `@keyframes vt-title-in`, `@supports (view-transition-name: test)` block

**Acceptance criteria status:**
- ✅ Backdrop header in show detail panel when TMDb backdrop available
- ✅ Library progress bar confirmed working (already existed)
- ✅ OG image uses light-mode palette
- ✅ Share card border-radius uses design token (decoration removed)
- ✅ View Transitions API: title morphs from library row to detail header (feature-detected, no polyfill)
- ✅ `prefers-reduced-motion` guard on transition animations
- ✅ No dark-mode hardcoded colors remaining
- ✅ TypeScript: clean
- ✅ 40 tests pass

---

## CONTROLS Phase 0 (Interaction audit + actions layer) ✅

**Adapted from RUNWAY-CONTROLS.md Phase 0**

**What was dead and why:**

- `addRecommendation`: toast fired BEFORE `fetch` — if the API call failed, the user saw a success toast but nothing was saved. Fixed: toast moved to success branch only.
- `removeRecommendationItem` (called from StatusBucket and RecommendationListItem): used `await fetch(...)` with no `response.ok` check and no UI revert — silent failure left a dangling optimistic delete. Fixed: added check + revert + error toast.
- `removeRecommendationList`: same pattern as above. Fixed likewise.
- `copyShareLink`: wrote to clipboard with no feedback at all. Fixed: `setToast('Link copied')` added.

**What was one-way without revert (fixed):**

- `persistWatchingItem`: optimistic add stayed in the list even if POST failed (only set `watchlistSource='local'`). Fixed: saves prior list snapshot, reverts the added item on failure, shows error toast.
- `updateWatchingItem`: optimistic patch stuck on failure. Fixed: reverts to the `item` argument (pre-patch) on failure, shows error toast.
- `removeWatching`: optimistic remove stuck on failure. Fixed: saves prior item, re-inserts at front on failure, shows error toast.
- `renameRecommendationList`: no error feedback. Fixed: reverts to prior name, shows error toast.
- `moveRecommendationItem`: no error feedback. Fixed: reverts to prior listId, shows error toast.
- `generateCalendarToken`: had `finally` block but no user feedback on failure. Fixed: shows error toast.

**New files:**

- `src/lib/actions.ts` — typed mutation layer. Every client→server write goes through one of its exported functions. Returns `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }`. Exports: `watchlistAdd`, `watchlistUpdate`, `watchlistRemove`, `recommendationsAddItem`, `recommendationsRemoveItem`, `recommendationsCreateList`, `recommendationsRenameList`, `recommendationsMoveItem`, `recommendationsRemoveList`, `calendarGetToken`, `calendarGenerateToken`.
- `docs/CONTROL-AUDIT.md` — full 71-row audit table classifying all interactive elements (✅/⚠️/❌/🔁). Zero ❌ rows after fixes.

**Acceptance criteria status:**
- ✅ `docs/CONTROL-AUDIT.md` exists, zero ❌ rows
- ✅ All mutations flow through `src/lib/actions.ts`
- ✅ No inline `fetch` calls remaining for mutations in `Runway.tsx`
- ✅ TypeScript: clean
- ✅ 40 tests pass
