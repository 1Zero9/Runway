export type TimeFit = 'any' | '30min' | '1hour' | 'film'

export type ShortlistRule =
  | 'LEAVING_SOON'
  | 'FINISH_LINE'
  | 'NEW_SEASON'
  | 'CONTINUE'
  | 'ON_TV_TONIGHT'
  | 'STALLED'
  | 'START_FRESH'

export type WatchlistItem = {
  id: string
  title: string
  service: string
  type?: string
  status?: string
  done: boolean
  lastWatchedAt?: string | null
  leavingDate?: string | null
  watchedCount?: number
  currentSeason?: number
  currentEpisode?: number
  posterPath?: string | null
  tmdbId?: number | null
  nextEpisode?: string
}

export type EpisodeCounts = {
  watched: number
  total: number
  avgRuntime?: number
}

export type ShortlistContext = {
  today: string
  tvTonightTitles?: Set<string>
  episodeCounts?: Map<string, EpisodeCounts>
  userProviders?: string[]
}

export type ShortlistEntry = {
  item: WatchlistItem
  rule: ShortlistRule
  reason: string
  action: string
}

const RULE_PRIORITY: Record<ShortlistRule, number> = {
  LEAVING_SOON: 1,
  FINISH_LINE: 2,
  NEW_SEASON: 3,
  CONTINUE: 4,
  ON_TV_TONIGHT: 5,
  STALLED: 6,
  START_FRESH: 7,
}

type Candidate = ShortlistEntry & { priorityKey: number; recency: string }

function dateOffset(from: string, days: number): string {
  const d = new Date(from + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000)
}

function getStatus(item: WatchlistItem): string {
  if (item.status) return item.status
  return item.done ? 'completed' : 'watching'
}

export function buildShortlist(
  items: WatchlistItem[],
  context: ShortlistContext,
  timeFit: TimeFit = 'any',
): ShortlistEntry[] {
  const { today, tvTonightTitles = new Set(), episodeCounts = new Map(), userProviders = [] } = context
  const fourteenDaysAgo = dateOffset(today, -14)
  const thirtyDaysAgo = dateOffset(today, -30)
  const fourteenDaysFromNow = dateOffset(today, 14)

  const candidates: Candidate[] = []
  const ruleCounts = new Map<ShortlistRule, number>()

  function addCandidate(entry: ShortlistEntry, recency: string) {
    const count = ruleCounts.get(entry.rule) ?? 0
    if (count >= 2) return // max two cards per rule
    ruleCounts.set(entry.rule, count + 1)
    candidates.push({ ...entry, priorityKey: RULE_PRIORITY[entry.rule], recency })
  }

  const normalizedTonightTitles = new Set(
    Array.from(tvTonightTitles).map((t) => t.trim().toLowerCase()),
  )

  for (const item of items) {
    const status = getStatus(item)
    if (status === 'completed' || status === 'dropped') continue

    const lw = item.lastWatchedAt ?? ''
    const counts = episodeCounts.get(item.id)
    const normalizedTitle = item.title.trim().toLowerCase()
    const epLabel =
      item.type !== 'film' && item.type !== 'sport' && item.currentSeason
        ? `S${String(item.currentSeason).padStart(2, '0')} E${String(item.currentEpisode ?? 0).padStart(2, '0')}`
        : null

    // LEAVING_SOON
    if (item.leavingDate && item.leavingDate <= fourteenDaysFromNow) {
      const days = daysBetween(today, item.leavingDate)
      const epsLeft = counts ? ` — ${counts.total - counts.watched} episode${counts.total - counts.watched === 1 ? '' : 's'} left` : ''
      addCandidate({
        item,
        rule: 'LEAVING_SOON',
        reason: `Leaving ${item.service} in ${days} day${days === 1 ? '' : 's'}${epsLeft}`,
        action: epLabel ? `Mark ${epLabel} watched` : 'Mark watched',
      }, lw)
    }

    // FINISH_LINE
    if (status === 'watching' && counts) {
      const remaining = counts.total - counts.watched
      if (remaining > 0 && remaining <= 3) {
        addCandidate({
          item,
          rule: 'FINISH_LINE',
          reason: `${remaining} episode${remaining === 1 ? '' : 's'} left — finish it`,
          action: epLabel ? `Mark ${epLabel} watched` : 'Mark watched',
        }, lw)
      }
    }

    // CONTINUE
    if (status === 'watching' && lw >= fourteenDaysAgo) {
      addCandidate({
        item,
        rule: 'CONTINUE',
        reason: epLabel ? `Next: ${epLabel} · ${item.service}` : `Continue · ${item.service}`,
        action: epLabel ? `Mark ${epLabel} watched` : 'Mark watched',
      }, lw)
    }

    // ON_TV_TONIGHT
    if (normalizedTonightTitles.has(normalizedTitle)) {
      addCandidate({
        item,
        rule: 'ON_TV_TONIGHT',
        reason: `On TV tonight · ${item.service}`,
        action: 'Mark watched',
      }, lw)
    }

    // STALLED
    if (status === 'watching' && lw && lw < thirtyDaysAgo) {
      addCandidate({
        item,
        rule: 'STALLED',
        reason: `Still going? Last watched ${lw}`,
        action: epLabel ? `Mark ${epLabel} watched` : 'Mark watched',
      }, lw)
    }

    // START_FRESH
    if (status === 'planned' || status === 'waiting') {
      const serviceMatches =
        userProviders.length === 0 ||
        userProviders.some((p) => item.service.toLowerCase().includes(p.toLowerCase()))
      if (serviceMatches) {
        addCandidate({
          item,
          rule: 'START_FRESH',
          reason: status === 'waiting' ? `Waiting for new season · ${item.service}` : `On your list · ${item.service}`,
          action: 'Start watching',
        }, item.nextEpisode ?? '')
      }
    }
  }

  // Sort by rule priority, then recency desc
  const sorted = candidates
    .sort((a, b) => {
      if (a.priorityKey !== b.priorityKey) return a.priorityKey - b.priorityKey
      return b.recency.localeCompare(a.recency)
    })
    .map(({ item, rule, reason, action }) => ({ item, rule, reason, action }))

  // Time-fit filter
  if (timeFit === 'film') {
    const films = sorted.filter((e) => e.item.type === 'film')
    return (films.length > 0 ? films : sorted).slice(0, 5)
  }
  if (timeFit === '30min' || timeFit === '1hour') {
    const maxMins = timeFit === '30min' ? 35 : 70
    const fitting = sorted.filter((e) => {
      const counts = episodeCounts.get(e.item.id)
      if (!counts?.avgRuntime) return true // no runtime data — include
      if (e.item.type === 'film') return counts.avgRuntime <= maxMins
      return counts.avgRuntime <= maxMins
    })
    return (fitting.length > 0 ? fitting : sorted).slice(0, 5)
  }

  return sorted.slice(0, 5)
}
