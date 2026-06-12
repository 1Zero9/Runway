/**
 * Single typed mutation layer for all Runway client-side writes.
 * Every fetch that changes server state goes through here — no inline fetches elsewhere.
 * Returns ActionResult<T> so callers can revert optimistic updates on failure.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─── Watchlist ────────────────────────────────────────────────────────────────

export type WatchlistPayload = {
  id: string
  title: string
  service: string
  nextEpisode: string
  cadence: string
  notes: string
  type?: string
  userRating?: number | null
  lastWatchedAt?: string | null
  watchedCount?: number
  done: boolean
  status?: string
  currentSeason?: number
  currentEpisode?: number
  tmdbId?: number | null
  posterPath?: string | null
  leavingDate?: string | null
  relationship?: string | null
  favouritedAt?: string | null
  recommendedAt?: string | null
}

export type WatchlistPatch = Partial<
  Pick<
    WatchlistPayload,
    | 'done'
    | 'lastWatchedAt'
    | 'status'
    | 'userRating'
    | 'watchedCount'
    | 'currentSeason'
    | 'currentEpisode'
    | 'tmdbId'
    | 'posterPath'
    | 'leavingDate'
    | 'relationship'
    | 'favouritedAt'
    | 'recommendedAt'
  >
> & { id: string }

export async function watchlistAdd(item: WatchlistPayload): Promise<ActionResult<WatchlistPayload>> {
  try {
    const res = await fetch('/api/media-guide/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    if (!res.ok) return { ok: false, error: 'Could not save to watchlist.' }
    const data = (await res.json()) as WatchlistPayload
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error saving watchlist item.' }
  }
}

export async function watchlistUpdate(patch: WatchlistPatch): Promise<ActionResult<WatchlistPayload>> {
  try {
    const res = await fetch('/api/media-guide/watchlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) return { ok: false, error: 'Could not update watchlist item.' }
    const data = (await res.json()) as WatchlistPayload
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error updating watchlist item.' }
  }
}

export async function watchlistRemove(id: string): Promise<ActionResult> {
  try {
    const res = await fetch(`/api/media-guide/watchlist?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) return { ok: false, error: 'Could not remove from watchlist.' }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Network error removing watchlist item.' }
  }
}

export async function watchlistSetRelationship(
  id: string,
  relationship: string | null,
): Promise<ActionResult<WatchlistPayload>> {
  return watchlistUpdate({ id, relationship })
}

export async function watchlistSetFavourite(
  id: string,
  on: boolean,
): Promise<ActionResult<WatchlistPayload>> {
  return watchlistUpdate({ id, favouritedAt: on ? new Date().toISOString() : null })
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export type RecommendationItemPayload = {
  id: string
  listId: string | null
  tmdbId: number | null
  mediaType: string
  status: 'seen' | 'favorite' | 'recommend' | 'not_interested'
  title: string
  service: string
  posterPath: string | null
  overview: string
  note: string
  dominantColour: string | null
}

export type RecommendationListPayload = {
  id: string
  name: string
  shareSlug: string
}

export async function recommendationsAddItem(
  item: Omit<RecommendationItemPayload, 'id' | 'dominantColour' | 'note'> & { listId: string | null; note?: string },
): Promise<ActionResult<RecommendationItemPayload>> {
  try {
    const res = await fetch('/api/media-guide/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-item', listId: item.listId, item }),
    })
    if (!res.ok) return { ok: false, error: 'Could not save recommendation.' }
    const data = (await res.json()) as RecommendationItemPayload
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error saving recommendation.' }
  }
}

export async function recommendationsRemoveItem(id: string): Promise<ActionResult> {
  try {
    const res = await fetch('/api/media-guide/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-item', itemId: id }),
    })
    if (!res.ok) return { ok: false, error: 'Could not remove recommendation.' }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Network error removing recommendation.' }
  }
}

export async function recommendationsCreateList(name: string): Promise<ActionResult<RecommendationListPayload>> {
  try {
    const res = await fetch('/api/media-guide/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-list', name }),
    })
    if (!res.ok) return { ok: false, error: 'Could not create list.' }
    const data = (await res.json()) as RecommendationListPayload
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error creating list.' }
  }
}

export async function recommendationsRenameList(
  listId: string,
  name: string,
): Promise<ActionResult<RecommendationListPayload>> {
  try {
    const res = await fetch('/api/media-guide/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename-list', listId, name }),
    })
    if (!res.ok) return { ok: false, error: 'Could not rename list.' }
    const data = (await res.json()) as RecommendationListPayload
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error renaming list.' }
  }
}

export async function recommendationsMoveItem(
  itemId: string,
  listId: string | null,
): Promise<ActionResult<RecommendationItemPayload>> {
  try {
    const res = await fetch('/api/media-guide/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move-item', itemId, listId }),
    })
    if (!res.ok) return { ok: false, error: 'Could not move recommendation.' }
    const data = (await res.json()) as RecommendationItemPayload
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error moving recommendation.' }
  }
}

export async function recommendationsRemoveList(listId: string): Promise<ActionResult> {
  try {
    const res = await fetch('/api/media-guide/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-list', listId }),
    })
    if (!res.ok) return { ok: false, error: 'Could not delete list.' }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Network error deleting list.' }
  }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function calendarGenerateToken(): Promise<ActionResult<{ token: string }>> {
  try {
    const res = await fetch('/api/calendar/token', { method: 'POST' })
    if (!res.ok) return { ok: false, error: 'Could not generate calendar token.' }
    const data = (await res.json()) as { token: string }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error generating calendar token.' }
  }
}

export async function calendarGetToken(): Promise<ActionResult<{ token: string | null }>> {
  try {
    const res = await fetch('/api/calendar/token')
    if (!res.ok) return { ok: false, error: 'Could not fetch calendar token.' }
    const data = (await res.json()) as { token: string | null }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error fetching calendar token.' }
  }
}
