# CONTROL-AUDIT.md — Phase 0 interaction audit

Produced for RUNWAY-CONTROLS.md Phase 0. One row per interactive element.
Legend: ✅ works round-trip · ⚠️ writes but no feedback/revert · ❌ broken wire · 🔁 one-way (no reverse)

---

## Header / navigation

| # | Location | Label / element | Handler | API route | DB write | Round-trip | Class |
|---|---|---|---|---|---|---|---|
| 1 | Topbar | Dashboard tab | `setTab('tonight')` | — | — | ✅ state only | ✅ |
| 2 | Topbar | Runway tab | `setTab('runway')` | — | — | ✅ state only | ✅ |
| 3 | Topbar | Library tab | `setTab('library')` | — | — | ✅ state only | ✅ |
| 4 | Topbar | TV Guide icon | `setTab('guide')` | — | — | ✅ state only | ✅ |
| 5 | Topbar | Settings icon | `setTab('settings')` | — | — | ✅ state only | ✅ |

## Dashboard tab

| # | Location | Label / element | Handler | API route | DB write | Round-trip | Class |
|---|---|---|---|---|---|---|---|
| 6 | Dashboard | Time-fit chips (4) | `setTimeFit(fit)` | — | — | ✅ state only | ✅ |
| 7 | Dashboard / Shortlist | ShortlistCard "Mark watched" | `markWatched(entry.item)` | PATCH /watchlist | watchlist row | UI reflects optimistically | 🔁 |
| 8 | Dashboard / Reconciliation | "Watched recently" confirm | `markWatched(item)` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 9 | Dashboard / Reconciliation | Dismiss card | `setReconDismissed(true)` | — | — | ✅ state only | ✅ |
| 10 | Dashboard / Continue watching | ContinueRail "Mark watched" | `markWatched(item)` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 11 | Dashboard / "On TV tonight" | "Full guide →" quiet link | `setTab('guide')` | — | — | ✅ state only | ✅ |
| 12 | Dashboard / "Worth a look" | Track button (`+`) | `persistWatchingItem(mediaToWatchingItem(item))` | POST /watchlist | new row | ⚠️ no revert on failure | 🔁 |
| 13 | Dashboard / Onboarding | Search form | `setDiscoveryQuery; setTab('runway')` | — | — | ✅ state only | ✅ |

## Guide tab

| # | Location | Label / element | Handler | API route | DB write | Round-trip | Class |
|---|---|---|---|---|---|---|---|
| 14 | Guide | Search field | `setQuery` | — | — | ✅ state only | ✅ |
| 15 | Guide | Sport toggle | `setSportOnly` | — | localStorage | ✅ stored | ✅ |
| 16 | Guide | From now / Full day buttons | `setListingTimeMode` | — | localStorage | ✅ stored | ✅ |
| 17 | Guide | Date field | `setSelectedDate` | — | — | ✅ state only | ✅ |
| 18 | Guide | Channel chips (all + per-channel) | `setChannelFilter` toggle | — | — | ✅ state only | ✅ |
| 19 | Guide | Settings cog chip | `setTab('settings')` | — | — | ✅ state only | ✅ |
| 20 | Guide / Programme rows | Track / Watchlist button | `persistWatchingItem(...)` | POST /watchlist | new row | ⚠️ no revert on failure | 🔁 |

## Runway tab

| # | Location | Label / element | Handler | API route | DB write | Round-trip | Class |
|---|---|---|---|---|---|---|---|
| 21 | Runway | Refresh sources button | `refreshSources()` | GET /tmdb-streaming, /cinema | — | ✅ reads back | ✅ |
| 22 | Runway | Provider filter buttons | `toggleProvider(label)` | — | localStorage | ✅ stored | ✅ |
| 23 | Runway / Discovery filters | Query input | `setDiscoveryQuery` | — | — | ✅ state only | ✅ |
| 24 | Runway / Discovery filters | Media type chips | `setDiscoveryMediaType` | — | localStorage | ✅ stored | ✅ |
| 25 | Runway / Discovery filters | Status filter chips | `setDiscoveryStatusFilter` | — | localStorage | ✅ stored | ✅ |
| 26 | Runway / Discovery filters | Genre select | `setDiscoveryGenreId` | — | — | ✅ state only | ✅ |
| 27 | Runway / Discovery filters | Poster scale slider | `setPosterScale` | — | localStorage | ✅ stored | ✅ |
| 28 | Runway / "Suggested for you" | Track button (`+`) | `persistWatchingItem(mediaToWatchingItem(item))` | POST /watchlist | new row | ⚠️ no revert on failure | 🔁 |
| 29 | Runway / MediaGrid (streaming) | Seen / Favourite / Recommend / Not for me | `addRecommendation(item, status)` | POST /recommendations | recommendations row | ❌ toast before API; silent on failure | 🔁 |
| 30 | Runway / MediaGrid (streaming) | Track button | `persistWatchingItem(mediaToWatchingItem(item))` | POST /watchlist | new row | ⚠️ no revert on failure | 🔁 |
| 31 | Runway / WatchlistGrid | Mark watched | `markWatched(item)` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 32 | Runway / WatchlistGrid | Remove | `removeWatching(id)` | DELETE /watchlist | delete row | ⚠️ no revert on failure | 🔁 |
| 33 | Runway / MediaGrid (cinema) | Seen / Favourite / Recommend / Not for me | `addRecommendation(item, status)` | POST /recommendations | recommendations row | ❌ toast before API; silent on failure | 🔁 |
| 34 | Runway / MediaGrid (cinema) | Track button | `persistWatchingItem(mediaToWatchingItem(item))` | POST /watchlist | new row | ⚠️ no revert on failure | 🔁 |

## Library tab

| # | Location | Label / element | Handler | API route | DB write | Round-trip | Class |
|---|---|---|---|---|---|---|---|
| 35 | Library / UpNextRail | Mark episode watched | `markWatched(item)` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 36 | Library / Add form | Submit ("Add to My List") | `addWatching → persistWatchingItem` | POST /watchlist | new row | ⚠️ no revert on failure | 🔁 |
| 37 | Library / watch-item | Check button (toggle complete) | `toggleWatching → updateWatchingStatus` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | ✅ (reverse = re-click) |
| 38 | Library / watch-item | Watch status `<select>` | `updateWatchingStatus` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | ✅ (reverse = change select) |
| 39 | Library / watch-item / episode tracker | Prev episode (−) | `updateEpisode` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | ✅ (reverse = +) |
| 40 | Library / watch-item / episode tracker | Next episode (+) | `updateEpisode` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | ✅ (reverse = −) |
| 41 | Library / watch-item / episode tracker | Next season (S+) | `updateEpisode` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 42 | Library / watch-item | "Ep watched / Watched" button | `markWatched` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 43 | Library / watch-item | Star rating (5 buttons) | `updateWatchingRating` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | ✅ (reverse = click same or lower star) |
| 44 | Library / watch-item | Open/close detail (ChevronRight) | `openShowDetail` | GET /show-details (read-only) | — | ✅ toggle | ✅ |
| 45 | Library / watch-item | Remove (Trash2) | `removeWatching(item.id)` | DELETE /watchlist | delete row | ⚠️ no revert on failure | 🔁 |
| 46 | Library / ShowDetailPanel | Episode grid squares | `handleEpisodeUpdate` | PATCH /watchlist | watchlist row | ⚠️ no revert on failure | 🔁 |
| 47 | Library / ShowDetailPanel | Leaving date input | `updateLeavingDate` | PATCH /watchlist | watchlist row | ✅ optimistic stands intentionally | ✅ |
| 48 | Library / Create list form | Submit ("Create Share List") | `createRecommendationList` | POST /recommendations | new list row | ✅ waits for response | ✅ |
| 49 | Library / StatusBucket | Remove (×) per item | `removeRecommendationItem(id)` | POST /recommendations (delete-item) | delete row | ❌ no response.ok check, no revert | 🔁 |
| 50 | Library / Recommendation list | Rename (input onBlur) | `renameRecommendationList` | POST /recommendations (rename-list) | update name | ⚠️ no error toast on failure | ✅ (reverse = rename again) |
| 51 | Library / Recommendation list | Copy Link button | `copyShareLink(slug)` | — (clipboard) | — | ❌ no toast feedback | — |
| 52 | Library / Recommendation list | Delete list (Trash2) | `removeRecommendationList(id)` | POST /recommendations (delete-list) | delete rows | ❌ no response.ok check, no revert | 🔁 |
| 53 | Library / RecommendationListItem | Move to list (`<select>`) | `moveRecommendationItem` | POST /recommendations (move-item) | update listId | ⚠️ no error toast on failure | ✅ (reverse = move back) |
| 54 | Library / RecommendationListItem | Remove (×) | `removeRecommendationItem(id)` | POST /recommendations (delete-item) | delete row | ❌ no response.ok check, no revert | 🔁 |

## Settings tab

| # | Location | Label / element | Handler | API route | DB write | Round-trip | Class |
|---|---|---|---|---|---|---|---|
| 55 | Settings / Listings | From now / Full day (settings copy) | `setListingTimeMode` | — | localStorage | ✅ stored | ✅ |
| 56 | Settings / Listings | Install / Installed button | `installApp` | — (PWA) | — | ✅ | ✅ |
| 57 | Settings / Channels | Favourites / All mode buttons | `setChannelMode` | — | localStorage | ✅ stored | ✅ |
| 58 | Settings / Channels | Channel open button | `setChannelFilter; setTab('tonight')` | — | — | ✅ | ✅ |
| 59 | Settings / Channels | Star button (toggle favourite) | `toggleFavoriteChannel(id)` | — | localStorage | ✅ stored / toggleable | ✅ |
| 60 | Settings / Channels | Reset starter Sky list | `resetFavoriteChannels()` | — | localStorage | ✅ | ✅ |
| 61 | Settings / Services | Provider settings chips | `toggleProvider(label)` | — | localStorage | ✅ stored / toggleable | ✅ |
| 62 | Settings / Categories | Genre hide buttons | `toggleHiddenGenre(id)` | — | localStorage | ✅ stored / toggleable | ✅ |
| 63 | Settings / Calendar | Generate calendar URL button | `generateCalendarToken()` | POST /calendar/token | new token row | ✅ | ✅ |
| 64 | Settings / Calendar | Copy URL button | clipboard + `setToast('Calendar URL copied')` | — | — | ✅ has toast | ✅ |
| 65 | Settings / Calendar | Regenerate button | `generateCalendarToken()` | POST /calendar/token | new token row | ✅ | ✅ |
| 66 | Settings | Logout button (implied) | `logout()` | POST /logout | session | ✅ | ✅ |

## Keyboard shortcuts

| # | Location | Label / element | Handler | Class |
|---|---|---|---|---|
| 67 | Global | `?` key — toggle keyboard help | `setShowKeyboardHelp` | ✅ |
| 68 | Global | `Esc` — close panel/overlay | `setDetailItemId(null)` / `setShowKeyboardHelp(false)` | ✅ |
| 69 | Global | `1/2/3` — switch tab | `setTab(...)` | ✅ |
| 70 | Global | `g` — guide tab | `setTab('guide')` | ✅ |
| 71 | Keyboard overlay | Close (×) button | `setShowKeyboardHelp(false)` | ✅ |

---

## Summary of failures found and fixed

### ❌ Broken wires (fixed in this phase)

| Control | Root cause | Fix |
|---|---|---|
| `addRecommendation` (#29, #33) | Toast fires before `fetch` — failure still shows toast | Move toast to success branch after `response.ok` |
| `removeRecommendationItem` (#49, #54) | No `await`, no `response.ok` check, no revert | Add await, check response, revert `setRecommendationItems` on failure |
| `removeRecommendationList` (#52) | No `response.ok` check, no revert | Add check, revert both lists and items state on failure |
| `copyShareLink` (#51) | No toast after clipboard write | Add `setToast('Link copied')` |

### ⚠️ Writes without revert (fixed in this phase)

| Control | Root cause | Fix |
|---|---|---|
| `persistWatchingItem` (#12, #20, #28, #30, #34, #36) | Optimistic add stays on failure | Save prior state, revert + error toast on catch |
| `removeWatching` (#32, #45) | Optimistic remove stays on failure | Save prior state, revert + error toast on catch |
| `updateWatchingItem` (underlying #7–10, #37–43, #46) | Only sets `watchlistSource=local`, doesn't revert | Revert to prior item on catch |
| `renameRecommendationList` (#50) | No error toast on failure | Add error toast on catch |
| `moveRecommendationItem` (#53) | No error toast on failure | Add error toast on catch |

### 🔁 No reverse action (deferred to Phase 2)

`markWatched`, single-direction episode increments, `removeWatching` (no undo), `addRecommendation` once confirmed — all deferred to Phase 2 toggle standard + undo toast.

---

*All ❌ rows resolved. All mutations now flow through `lib/actions.ts`. UI-NOTES.md updated.*
