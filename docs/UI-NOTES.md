# UI-NOTES.md

Read this at the start of every session before touching any CSS or component code.

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

## Phase 4 — Tonight board

Not started.

## Phase 5 — Runway view

Not started.

## Phase 6 — Library

Not started.

## Phase 7 — Share pages

Not started.

## Phase 8 — Motion & final polish

Not started.
