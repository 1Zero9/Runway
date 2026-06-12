# RESET-FINDINGS.md — Phase 0 Diagnostic

_Produced: 2026-06-12. No code changed in this phase (two pre-existing fixes committed before the brief was read: `041df20` hero layout, `e2362f1` hero fallback — both noted where relevant)._

---

## Failure 1 — Why is no artwork rendering?

**Root cause: null `poster_path` for existing rows — not a pipeline bug.**

The artwork chain is correctly wired end-to-end when a show is added via TMDb search:

| Step | File | Status |
|------|------|--------|
| TMDb result → WatchingItem | `Runway.tsx:3631` `posterPath: item.poster_path ?? null` | ✓ |
| WatchingItem → watchlist POST | `actions.ts:57-60` + `watchlist/route.ts:97` `${payload.posterPath ?? null}` | ✓ |
| DB column exists | `watchlist/route.ts:220` `add column if not exists poster_path text` | ✓ |
| URL construction | `Runway.tsx:2802` `https://image.tmdb.org/t/p/w185${item.posterPath}` | ✓ |
| next.config remotePatterns | `next.config.ts:9-10` `image.tmdb.org /t/p/**` | ✓ |

**Why MINDHUNTER / Severance / Tulsa King show letter initials:** These rows were inserted into `media_watchlist` before the `poster_path` column was added by migration, or via a manual-entry path that bypasses `mediaToWatchingItem`. The `add column if not exists` migration adds the column with a null default and **does not backfill** existing rows. No fetch has enriched them since.

**TMDB_API_KEY on Vercel:** Not verifiable locally. The health check to be added in Phase 1 will surface this explicitly on load.

---

## Failure 2 — Why does Shortlist show first-run while Continue Watching shows three shows?

**Root cause: `buildShortlist` CONTINUE rule excludes shows with null `lastWatchedAt`.**

`buildShortlist` (`shortlist.ts:104`, `138`):
```ts
const lw = item.lastWatchedAt ?? ''           // null → empty string
if (status === 'watching' && lw >= fourteenDaysAgo) { addCandidate(CONTINUE) }
```

Empty string is lexicographically less than any ISO date string, so `'' >= '2026-05-29'` is **false**. A freshly added show with `lastWatchedAt = null` fires no rule:

- `CONTINUE` — fails (`lw` is falsy, empty string < any date)
- `FINISH_LINE` — requires `episodeCounts` from `showDetailCache`, which requires a prior Shortlist top item (chicken-and-egg)
- `START_FRESH` — requires `status === 'planned' || status === 'waiting'`; newly tracked shows have effective status `'watching'`
- `STALLED` — requires `lw && lw < thirtyDaysAgo`; `lw` is falsy
- `ON_TV_TONIGHT` — would fire if EPG matched, but not for these titles tonight

Continue Watching uses `watching.filter(i => getWatchStatus(i) === 'watching')` (`Runway.tsx:316-317`) with no recency gate. The two views draw from the same source (`media_watchlist` via `watching` state) but apply different filters — hence the contradiction.

**Fix (Phase 2):** Change CONTINUE to `!lw || lw >= fourteenDaysAgo` — include shows never watched (just added).

---

## Failure 3 — Why is everything S01E01?

**Root cause: shows are genuinely at S01E01 — no write failure, but episode advancement depends on a circular cache dependency.**

The three shows were recently added. No episodes have been confirmed watched, so `currentSeason = 1, currentEpisode = 1` is correct state. The reconciliation card is showing them as catch-up candidates because `lastWatchedAt` is null — it fires for `!i.lastWatchedAt || i.lastWatchedAt < threshold` (`Runway.tsx:325`).

Episode auto-advance path (`markWatched` in Runway.tsx):
1. Calls `watchlistUpdate` with new `currentSeason`/`currentEpisode`
2. Advances using `TmdbShowDetail` from `showDetailCache`
3. `showDetailCache` is populated only when `topItemTmdbId` is non-null
4. `topItemTmdbId` was previously derived only from `shortlistItems[0]`
5. Shortlist is empty (Failure 2) → `topItemTmdbId = null` → no TMDb fetch → no episode data to advance with

The `pre-existing fix` in `e2362f1` addresses this by falling back to `watching[0].tmdbId`, breaking the cycle.

**Secondary concern — two disconnected tracking systems:**
- `media_watchlist`: stores `current_season`, `current_episode` (used by Shortlist + Continue Watching)
- `runway_shows` + `runway_watch_events`: stores episode-level events (used by episode grid)
- `queryDashboard` (`runway-db.ts:150`) is never called from `Runway.tsx` — the `/api/media-guide/dashboard` route exists but is fetched by nothing. The `runway_watch_events` system is orphaned from the dashboard. This is the "two data paths" the brief identifies; Phase 2 must resolve it.

---

## Failure 4 — Why does the hero render as a grey band?

**Root cause: CSS specificity override made the backdrop image in-flow (layout bug); secondary cause is backdrop loading grey due to neutral image colours.**

`.dashboard-hero-wrap > * { position: relative }` (`runway.css:4304`) applied to ALL direct children including `.dashboard-hero-bg`, overriding its `position: absolute`. This caused the 1280×720 `<Image>` to render in the normal document flow, consuming ~730px of vertical space and pushing the greeting and Shortlist below the fold.

**Pre-existing fix** (`041df20`): changed selector to `> *:not(.dashboard-hero-bg)`.

**Secondary issue:** even after the layout fix, the blurred backdrop appears as an undifferentiated grey wash because:
- The shows in `watching` had null `tmdbId` (or the hero fallback hadn't fired yet)
- A neutral/dark backdrop becomes near-white at 14% opacity over `--bg`

Degrade-to-absence rule (Phase 6): hero must render nothing until the backdrop image `onLoad` fires, not the wash-only state.

---

## Module inventory — Dashboard (as of 2026-06-12)

| # | Module | Data source | Current state |
|---|--------|-------------|---------------|
| 1 | Masthead (date + summary line) | `watching` count + EPG/Library derived | **Working** — shows correct count and TV-tonight note |
| 2 | Time-fit chips | UI state only | **Working** |
| 3 | Ambient hero backdrop | `showDetailCache[topItemTmdbId].backdropPath` | **Broken** — position bug fixed; backdrop still grey/absent |
| 4 | Shortlist | `buildShortlist(watching, …)` | **Broken** — empty for any show with null `lastWatchedAt` |
| 5 | Reconciliation card | `watching` filtered to unwatched / stale | **Misleading** — fires on new adds (not just genuine gaps) |
| 6 | Continue Watching rail | `watching` filtered to 'watching' status | **Partially working** — data correct, no artwork |
| 7 | Coming Up countdown | `watching` leavingDate | **Conditionally working** — absent when no leaving dates |
| 8 | On TV Tonight | TVMaze EPG | **Working** (when EPG returns matches) |
| 9 | Worth a Look / suggestions | TMDb recommendations seeded from favourites | **Working** if seeds exist |

---

## Summary of root causes

| Failure | Root cause | Fix phase |
|---------|-----------|-----------|
| No artwork | `poster_path` null for pre-migration rows; no backfill | Phase 1 |
| Shortlist empty | `buildShortlist` CONTINUE rule excludes null `lastWatchedAt` | Phase 2 |
| S01E01 everywhere | Shows genuinely new; episode advance needs TMDb cache (now fixed via fallback) | Phase 2 |
| Hero grey band | `position: relative` override (fixed); + degrade-to-absence needed | Phase 6 |
| Two data systems | `runway_watch_events` orphaned from dashboard render | Phase 2 |
