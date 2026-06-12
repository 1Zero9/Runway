'use client'

import {
  CalendarDays,
  Check,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  Eye,
  Filter,
  Heart,
  LayoutDashboard,
  ListPlus,
  MonitorPlay,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Tv,
  ThumbsDown,
} from 'lucide-react'
import Image from 'next/image'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { formatEpisodeLabel } from '@/lib/episode-label'
import { buildShortlist } from '@/lib/shortlist'
import type { WatchlistItem } from '@/lib/shortlist'
import {
  watchlistAdd,
  watchlistUpdate,
  watchlistRemove,
  watchlistSetRelationship,
  watchlistSetFavourite,
  recommendationsAddItem,
  recommendationsRemoveItem,
  recommendationsCreateList,
  recommendationsRenameList,
  recommendationsMoveItem,
  recommendationsRemoveList,
  calendarGetToken,
  calendarGenerateToken,
} from '@/lib/actions'
import {
  statusToRelationship,
  relationshipToStatus,
  isLegalTransition,
  relationshipLabel,
  relationshipActionLabel,
} from '@/lib/title-state'
import type { Relationship } from '@/lib/title-state'
import './runway.css'

type Tab = 'tonight' | 'runway' | 'library' | 'settings' | 'guide'
type TimeFit = 'any' | '30min' | '1hour' | 'film'
type ShortlistEntry = { item: WatchingItem; reason: string; action: string }
type ListingTimeMode = 'from_now' | 'full_day'
type DiscoveryMediaType = 'all' | 'movie' | 'tv'
type DiscoveryStatusFilter = 'all' | 'unselected' | RecommendationItem['status']
type WatchStatus = 'planned' | 'watching' | 'waiting' | 'completed' | 'dropped'
type WatchItemType = 'show' | 'film' | 'sport' | 'other'
type LibraryFilter = 'all' | 'watching' | 'watchlisted' | 'finished' | 'favourites' | 'recommended' | 'abandoned'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type TvMazeEpisode = {
  id: number | string
  name: string
  season: number
  number: number | null
  airtime: string
  airstamp: string
  runtime: number | null
  show: {
    id: number | string
    name: string
    type: string
    language: string
    image?: { medium?: string }
    genres?: string[]
    network?: { name: string }
    webChannel?: { name: string }
  }
}

type EpgChannel = {
  id: string
  icon?: string
  name: string
}

type TmdbItem = {
  id: number
  title?: string
  name?: string
  media_type?: 'movie' | 'tv'
  overview: string
  poster_path: string | null
  vote_average: number
  genre_ids?: number[]
  release_date?: string
  first_air_date?: string
  provider?: string
}

type Provider = {
  id: number
  label: string
  match: string[]
  enabled: boolean
}

type WatchingItem = {
  id: string
  title: string
  service: string
  nextEpisode: string
  cadence: string
  notes: string
  type?: WatchItemType
  userRating?: number | null
  lastWatchedAt?: string | null
  watchedCount?: number
  done: boolean
  status?: WatchStatus
  currentSeason?: number
  currentEpisode?: number
  tmdbId?: number | null
  posterPath?: string | null
  leavingDate?: string | null
  relationship?: Relationship | null
  favouritedAt?: string | null
  recommendedAt?: string | null
}

type TmdbShowDetail = {
  id: number
  name: string
  numberOfEpisodes: number
  episodeRunTime: number[]
  seasons: { seasonNumber: number; episodeCount: number }[]
  backdropPath?: string | null
}

type RecommendationList = {
  id: string
  name: string
  shareSlug: string
}

type RecommendationItem = {
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

const defaultProviders: Provider[] = [
  { id: 0, label: 'Sky / NOW', match: ['Sky Go', 'NOW', 'Now TV'], enabled: true },
  { id: 0, label: 'Netflix', match: ['Netflix'], enabled: true },
  { id: 0, label: 'Prime Video', match: ['Amazon Prime Video', 'Prime Video'], enabled: true },
  { id: 0, label: 'Apple TV+', match: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], enabled: true },
  { id: 0, label: 'Paramount+', match: ['Paramount Plus', 'Paramount+'], enabled: true },
]

const appVersion = '0.1.5'

// Phase 3 (RUNWAY-RESET.md): strip to three modules until quality proven.
// Re-admit each module in Phase 5 after screenshot evidence + prod-bar verdict.
const DASHBOARD_MODULES = {
  reconciliation: false,
  comingUp:       false,
  onTvTonight:    false,
  worthALook:     false,
} as const
const watchStatusOrder: WatchStatus[] = ['watching', 'waiting', 'planned', 'completed', 'dropped']

const fallbackStreaming: TmdbItem[] = [
  {
    id: 9001,
    title: 'Streaming source unavailable',
    overview: 'Runway could not load TMDb streaming data. Check the message above and refresh.',
    poster_path: null,
    vote_average: 0,
    provider: 'Ireland streaming',
    media_type: 'movie',
  },
]

const starterWatching: WatchingItem[] = [
  {
    id: 'starter-slow-horses',
    title: 'Example: Slow Horses',
    service: 'Apple TV+',
    nextEpisode: '2026-06-07',
    cadence: 'Weekly',
    notes: 'Replace this with one of your own shows.',
    type: 'show',
    userRating: null,
    lastWatchedAt: null,
    watchedCount: 0,
    done: false,
  },
]

const starterSkyChannelMatches = [
  'RTÉ One',
  'RTE One',
  'RTÉ2',
  'RTE2',
  'Virgin Media One',
  'Virgin Media Two',
  'Virgin Media Three',
  'TG4',
  'BBC One',
  'BBC Two',
  'UTV',
  'Channel 4',
  'Sky Showcase',
  'Sky Atlantic',
  'Sky Max',
  'Sky Cinema Premiere',
  'Sky Sports Main Event',
  'Sky Sports Premier League',
  'Sky Sports F1',
  'Sky News',
  'Comedy Central',
  'Discovery',
  'National Geographic',
  'More4',
  'E4',
  'Channel 5',
  'Film4',
]

const dadChannelName = 'More4'

function App() {
  const [tab, setTab] = useState<Tab>('tonight')
  const [selectedDate, setSelectedDate] = useState(() => formatIrelandDate(new Date()))
  const [tvItems, setTvItems] = useState<TvMazeEpisode[]>([])
  const [tvChannels, setTvChannels] = useState<EpgChannel[]>([])
  const [tvLoading, setTvLoading] = useState(false)
  const [tvError, setTvError] = useState('')
  const [listingTimeMode, setListingTimeMode] = useStoredState<ListingTimeMode>(
    'mediaguide.listingTimeMode',
    'from_now',
  )
  const [now, setNow] = useState(() => new Date())
  const [channelMode, setChannelMode] = useStoredState<'favorites' | 'all'>('mediaguide.channelMode', 'favorites')
  const [favoriteChannelIds, setFavoriteChannelIds] = useStoredState<string[] | null>(
    'mediaguide.favoriteChannelIds',
    null,
  )
  const [providers, setProviders] = useStoredState<Provider[]>('mediaguide.providers', defaultProviders)
  const [hiddenGenreIds, setHiddenGenreIds] = useStoredState<number[]>('mediaguide.hiddenGenres', [])
  const [watching, setWatching] = useStoredState<WatchingItem[]>('mediaguide.watching', starterWatching)
  const [watchlistSource, setWatchlistSource] = useState<'syncing' | 'neon' | 'local'>('syncing')
  const [streaming, setStreaming] = useState<TmdbItem[]>(fallbackStreaming)
  const [cinema, setCinema] = useState<TmdbItem[]>([])
  const [tmdbLoading, setTmdbLoading] = useState(false)
  const [tmdbError, setTmdbError] = useState('')
  const [tmdbRefreshedAt, setTmdbRefreshedAt] = useState('')
  const [tmdbRefreshNonce, setTmdbRefreshNonce] = useState(0)
  const [refreshPulse, setRefreshPulse] = useState(false)
  const [query, setQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [sportOnly, setSportOnly] = useStoredState('mediaguide.sportOnly', false)
  const [discoveryQuery, setDiscoveryQuery] = useState('')
  const [discoveryGenreId, setDiscoveryGenreId] = useState(0)
  const [discoveryMediaType, setDiscoveryMediaType] = useStoredState<DiscoveryMediaType>(
    'mediaguide.discoveryMediaType',
    'all',
  )
  const [discoveryStatusFilter, setDiscoveryStatusFilter] = useStoredState<DiscoveryStatusFilter>(
    'mediaguide.discoveryStatusFilter',
    'all',
  )
  const [posterScale, setPosterScale] = useStoredState('mediaguide.posterScale', 100)
  const [recommendationLists, setRecommendationLists] = useState<RecommendationList[]>([])
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItem[]>([])
  const [suggestions, setSuggestions] = useState<TmdbItem[]>([])
  const [genreMap, setGenreMap] = useState<Record<number, string>>({})
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installState, setInstallState] = useState<'available' | 'installed' | 'manual'>('manual')
  const [toast, setToast] = useState('')
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [showDetailCache, setShowDetailCache] = useState<Record<number, TmdbShowDetail>>({})
  const [pulsingItemId, setPulsingItemId] = useState<string | null>(null)
  const [timeFit, setTimeFit] = useState<TimeFit>('any')
  const [reconDismissed, setReconDismissed] = useState(false)
  const [calendarToken, setCalendarToken] = useState<string | null>(null)
  const [calendarTokenLoading, setCalendarTokenLoading] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [transitioningItemId, setTransitioningItemId] = useState<string | null>(null)
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null)
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useStoredState<string[]>('mediaguide.recentSearches', [])
  const [libraryFilter, setLibraryFilter] = useStoredState<LibraryFilter>('mediaguide.libraryFilter', 'watching')
  const [completionPrompt, setCompletionPrompt] = useState<WatchingItem | null>(null)
  const [completionDismissed, setCompletionDismissed] = useStoredState<string[]>('mediaguide.completionDismissed', [])
  const [caughtUpIds, setCaughtUpIds] = useState<Set<string>>(new Set())
  const refreshPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const caughtUpTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const inProgressShows = watching
    .filter((i) => getWatchStatus(i) === 'watching')
    .sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''))

  const reconItems = useMemo(() => {
    if (reconDismissed) return []
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const threshold = formatIrelandDate(sevenDaysAgo)
    return inProgressShows.filter((i) => !i.lastWatchedAt || i.lastWatchedAt < threshold)
  }, [inProgressShows, now, reconDismissed])

  const discoveryStatusByKey = useMemo(
    () =>
      recommendationItems.reduce((map, item) => {
        const key = getRecommendationItemKey(item)
        if (!key) return map
        const statuses = map.get(key) ?? new Set<RecommendationItem['status']>()
        statuses.add(item.status)
        map.set(key, statuses)
        return map
      }, new Map<string, Set<RecommendationItem['status']>>()),
    [recommendationItems],
  )
  const dominantColourByKey = useMemo(
    () =>
      recommendationItems.reduce((map, item) => {
        const key = getRecommendationItemKey(item)
        if (!key || !item.dominantColour) return map
        if (!map.has(key)) map.set(key, item.dominantColour)
        return map
      }, new Map<string, string>()),
    [recommendationItems],
  )
  const hiddenGenres = useMemo(() => new Set(hiddenGenreIds), [hiddenGenreIds])
  const filteredStreamingItems = useMemo(
    () => streaming.filter((item) => isVisibleDiscoveryItem(item, hiddenGenres)),
    [hiddenGenres, streaming],
  )
  const filteredCinemaItems = useMemo(
    () => cinema.filter((item) => isVisibleDiscoveryItem(item, hiddenGenres)),
    [cinema, hiddenGenres],
  )
  const genreOptions = useMemo(() => {
    const ids = new Set<number>()
    ;[...streaming, ...cinema].forEach((item) => item.genre_ids?.forEach((id) => ids.add(id)))
    return Array.from(ids)
      .map((id) => ({ id, name: genreMap[id] }))
      .filter((genre): genre is { id: number; name: string } => Boolean(genre.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [cinema, genreMap, streaming])
  const suggestedFavoriteChannelIds = useMemo(() => {
    if (!tvChannels.length) return []
    return tvChannels
      .filter((channel) => {
        const normalizedName = channel.name.toLowerCase()
        return starterSkyChannelMatches.some((candidate) => normalizedName.includes(candidate.toLowerCase()))
      })
      .map((channel) => channel.id)
      .slice(0, 28)
  }, [tvChannels])
  const effectiveFavoriteChannelIds = favoriteChannelIds ?? suggestedFavoriteChannelIds
  const favoriteChannelSet = useMemo(() => new Set(effectiveFavoriteChannelIds), [effectiveFavoriteChannelIds])
  const selectedChannelIds = useMemo(() => {
    if (channelFilter !== 'all') return [channelFilter]
    if (channelMode === 'favorites') return effectiveFavoriteChannelIds
    return []
  }, [channelFilter, channelMode, effectiveFavoriteChannelIds])
  const selectedChannelKey = selectedChannelIds.join(',')
  const favoriteChannels = useMemo(
    () => tvChannels.filter((channel) => favoriteChannelSet.has(channel.id)),
    [favoriteChannelSet, tvChannels],
  )
  const channelOptions = useMemo(() => {
    return tvChannels.length
      ? tvChannels
      : Array.from(
          new Map(
            tvItems.map((item) => [
              getProgrammeChannelId(item),
              {
                id: getProgrammeChannelId(item),
                name: item.show.network?.name ?? item.show.webChannel?.name ?? 'Ireland TV',
              },
            ]),
          ).values(),
        ).sort((a, b) => a.name.localeCompare(b.name))
  }, [tvChannels, tvItems])

  const filteredTvItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    const isToday = selectedDate === formatIrelandDate(new Date())
    const currentTime = now.getTime()
    return tvItems.filter((item) => {
      const channelId = getProgrammeChannelId(item)
      const channel = item.show.network?.name ?? item.show.webChannel?.name ?? ''
      const matchesChannel = channelFilter === 'all' || channelId === channelFilter
      const matchesMode = channelFilter !== 'all' || channelMode === 'all' || favoriteChannelSet.has(channelId)
      const matchesTerm = !term || `${item.show.name} ${item.name} ${channel}`.toLowerCase().includes(term)
      const matchesSport = !sportOnly || isSportProgramme(item)
      const startTime = Date.parse(item.airstamp)
      const endTime = startTime + (item.runtime ?? 180) * 60 * 1000
      const matchesTime =
        listingTimeMode === 'full_day' || !isToday || endTime >= currentTime - 1000 * 60 * 5
      return matchesChannel && matchesMode && matchesTerm && matchesSport && matchesTime
    })
  }, [channelFilter, channelMode, favoriteChannelSet, listingTimeMode, now, query, selectedDate, sportOnly, tvItems])
  const filteredLibraryItems = useMemo(() => {
    if (libraryFilter === 'all') return watching
    return watching.filter((item) => {
      const rel = item.relationship ?? statusToRelationship(item.status, item.done)
      if (libraryFilter === 'watching') return rel === 'tracking'
      if (libraryFilter === 'watchlisted') return rel === 'watchlisted'
      if (libraryFilter === 'finished') return rel === 'finished'
      if (libraryFilter === 'favourites') return Boolean(item.favouritedAt)
      if (libraryFilter === 'recommended') return Boolean(item.recommendedAt)
      if (libraryFilter === 'abandoned') return rel === 'abandoned'
      return true
    })
  }, [watching, libraryFilter])

  const libraryFilterCounts = useMemo(() => {
    const counts: Record<LibraryFilter, number> = { all: watching.length, watching: 0, watchlisted: 0, finished: 0, favourites: 0, recommended: 0, abandoned: 0 }
    for (const item of watching) {
      const rel = item.relationship ?? statusToRelationship(item.status, item.done)
      if (rel === 'tracking') counts.watching++
      if (rel === 'watchlisted') counts.watchlisted++
      if (rel === 'finished') counts.finished++
      if (rel === 'abandoned') counts.abandoned++
      if (item.favouritedAt) counts.favourites++
      if (item.recommendedAt) counts.recommended++
    }
    return counts
  }, [watching])

  const watchGroups = useMemo(
    () =>
      watchStatusOrder
        .map((status) => ({
          status,
          items: filteredLibraryItems.filter((item) => getWatchStatus(item) === status),
        }))
        .filter((group) => group.items.length),
    [filteredLibraryItems],
  )
  const trackedTitleSet = useMemo(
    () => new Set(watching.map((item) => normalizeTitle(item.title))),
    [watching],
  )

  const tvTonightTracked = useMemo(() => {
    const todayStr = formatIrelandDate(now)
    const nowMs = now.getTime()
    return tvItems
      .filter((item) => {
        if (formatIrelandDate(new Date(item.airstamp)) !== todayStr) return false
        const endMs = Date.parse(item.airstamp) + (item.runtime ?? 60) * 60 * 1000
        if (endMs < nowMs - 5 * 60 * 1000) return false
        return trackedTitleSet.has(normalizeTitle(item.show.name))
      })
      .slice(0, 8)
  }, [now, trackedTitleSet, tvItems])

  const shortlistItems = useMemo(() => {
    const today = formatIrelandDate(now)
    const tvTonightTitles = new Set(tvTonightTracked.map((e) => e.show.name))
    const episodeCounts = new Map<string, { watched: number; total: number; avgRuntime?: number }>(
      watching
        .filter((item) => item.tmdbId && showDetailCache[item.tmdbId])
        .map((item) => {
          const detail = showDetailCache[item.tmdbId!]!
          const currentSeason = item.currentSeason ?? 1
          const currentEpisode = item.currentEpisode ?? 0
          const watched = detail.seasons.reduce((sum, s) => {
            if (s.seasonNumber < currentSeason) return sum + s.episodeCount
            if (s.seasonNumber === currentSeason) return sum + currentEpisode
            return sum
          }, 0)
          const avgRuntime = detail.episodeRunTime.length ? detail.episodeRunTime[0] : undefined
          return [item.id, { watched, total: detail.numberOfEpisodes, avgRuntime }]
        })
    )
    const userProviders = providers.filter((p) => p.enabled).flatMap((p) => p.match)
    return buildShortlist(watching as WatchlistItem[], { today, tvTonightTitles, episodeCounts, userProviders }, timeFit)
      .map((e) => ({ item: e.item as WatchingItem, reason: e.reason, action: e.action }))
  }, [watching, timeFit, now, tvTonightTracked, showDetailCache, providers])

  const topItemTmdbId = useMemo(() => {
    const shortlistTop = shortlistItems[0]?.item
    if (shortlistTop?.tmdbId && shortlistTop.type !== 'film') return shortlistTop.tmdbId
    // Fall back to first in-progress TV show with a TMDb ID
    const fallback = watching.find((w) => w.tmdbId && w.type !== 'film')
    return fallback?.tmdbId ?? null
  }, [shortlistItems, watching])

  const heroBackdropPath = useMemo(
    () => (topItemTmdbId ? showDetailCache[topItemTmdbId]?.backdropPath ?? null : null),
    [topItemTmdbId, showDetailCache],
  )

  const calendarEvents = useMemo(() => {
    const watchEvents = watching
      .filter((item) => !['completed', 'dropped'].includes(getWatchStatus(item)))
      .map((item) => ({
        id: `watch-${item.id}`,
        date: item.nextEpisode,
        title: item.title,
        meta: `${watchStatusLabel(getWatchStatus(item))} - ${item.service || 'My List'}`,
      }))
    const cinemaEvents = cinema
      .filter((item) => item.release_date)
      .slice(0, 12)
      .map((item) => ({
        id: `cinema-${item.id}`,
        date: item.release_date as string,
        title: item.title ?? item.name ?? 'Cinema release',
        meta: 'Cinema release',
      }))

    return [...watchEvents, ...cinemaEvents]
      .filter((item) => item.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 18)
  }, [cinema, watching])

  const visibleStreamingItems = useMemo(
    () =>
      filterDiscoveryItems(
        filteredStreamingItems,
        discoveryQuery,
        discoveryGenreId,
        discoveryMediaType,
        discoveryStatusFilter,
        discoveryStatusByKey,
      ),
    [
      discoveryGenreId,
      discoveryMediaType,
      discoveryQuery,
      discoveryStatusByKey,
      discoveryStatusFilter,
      filteredStreamingItems,
    ],
  )
  const visibleCinemaItems = useMemo(
    () =>
      filterDiscoveryItems(
        filteredCinemaItems,
        discoveryQuery,
        discoveryGenreId,
        'movie',
        discoveryStatusFilter,
        discoveryStatusByKey,
      ),
    [discoveryGenreId, discoveryQuery, discoveryStatusByKey, discoveryStatusFilter, filteredCinemaItems],
  )

  const activeWatchingItems = useMemo(
    () => watching.filter((i) => !['completed', 'dropped'].includes(getWatchStatus(i))),
    [watching],
  )

  const countdownItems = useMemo(() => {
    const today = formatIrelandDate(new Date())
    const cinemaItems = cinema
      .filter((i) => i.release_date && i.release_date >= today)
      .map((i) => {
        const days = getDaysUntil(i.release_date as string)
        return {
          kind: 'cinema' as const,
          id: `cinema-${i.id}`,
          title: i.title ?? i.name ?? 'Untitled',
          posterPath: i.poster_path,
          date: i.release_date as string,
          days,
          chip: days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days} DAYS`,
          dominantColour: dominantColourByKey.get(getTmdbItemKey(i)) ?? null,
          tmdbItem: i,
        }
      })
    const watchItems = activeWatchingItems
      .filter((i) => i.nextEpisode >= today)
      .map((i) => {
        const days = getDaysUntil(i.nextEpisode)
        const seasonPrefix =
          i.type !== 'film' && i.type !== 'sport' && i.currentSeason
            ? `S${String(i.currentSeason).padStart(2, '0')} · `
            : ''
        const dayStr = days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days} DAYS`
        return {
          kind: 'watch' as const,
          id: `watch-${i.id}`,
          title: i.title,
          posterPath: i.posterPath ?? null,
          date: i.nextEpisode,
          days,
          chip: `${seasonPrefix}${dayStr}`,
          dominantColour: null as null,
          watchItem: i,
        }
      })
    return [...cinemaItems, ...watchItems].sort((a, b) => a.date.localeCompare(b.date))
  }, [activeWatchingItems, cinema, dominantColourByKey])

  const countdownGroups = useMemo(() => {
    const today = new Date()
    const weekDate = new Date(today); weekDate.setDate(today.getDate() + 7)
    const monthDate = new Date(today); monthDate.setDate(today.getDate() + 30)
    const weekStr = formatIrelandDate(weekDate)
    const monthStr = formatIrelandDate(monthDate)
    return [
      { label: 'Out this week', items: countdownItems.filter((i) => i.date <= weekStr) },
      { label: 'This month', items: countdownItems.filter((i) => i.date > weekStr && i.date <= monthStr) },
      { label: 'Coming up', items: countdownItems.filter((i) => i.date > monthStr) },
    ].filter((g) => g.items.length > 0)
  }, [countdownItems])

  const mastheadLine = useMemo(() => {
    const inProgress = watching.filter((i) => getWatchStatus(i) === 'watching').length
    const soonItem = countdownItems.find((i) => i.days <= 7)
    const parts: string[] = []
    if (inProgress > 0) parts.push(`${inProgress} show${inProgress === 1 ? '' : 's'} on the go`)
    if (soonItem) {
      const when = soonItem.days === 0 ? 'out today' : soonItem.days === 1 ? 'out tomorrow' : 'out this week'
      // Quote the title to avoid ambiguous sentences ("One More Chance is out today")
      parts.push(`‘${soonItem.title}’ is ${when}`)
    }
    return parts.join(' · ')
  }, [watching, countdownItems])

  useEffect(() => {
    let ignore = false
    async function loadSchedule() {
      setTvLoading(true)
      setTvError('')
      try {
        const params = new URLSearchParams({ date: selectedDate })
        if (selectedChannelKey) params.set('channels', selectedChannelKey)
        const response = await fetch(`/api/media-guide/epg?${params.toString()}`)
        if (!response.ok) throw new Error('Could not load Irish TV schedule.')
        const data = (await response.json()) as { channels?: EpgChannel[]; schedule: TvMazeEpisode[] }
        if (!ignore) {
          setTvChannels(data.channels ?? [])
          setTvItems(data.schedule)
        }
      } catch (error) {
        if (!ignore) setTvError(error instanceof Error ? error.message : 'Could not load TV schedule.')
      } finally {
        if (!ignore) setTvLoading(false)
      }
    }
    loadSchedule()
    return () => {
      ignore = true
    }
  }, [selectedDate, selectedChannelKey])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 60)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tab !== 'guide') return
    const timer = window.setTimeout(() => {
      nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [filteredTvItems.length, tab])

  useEffect(() => {
    let ignore = false
    async function loadTmdb() {
      setTmdbLoading(true)
      try {
        const response = await fetch('/api/media-guide/tmdb', {
          cache: 'no-store',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providers }),
        })
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error ?? 'Could not load TMDb data.')
        }
        const data = (await response.json()) as {
          genreMap: Record<number, string>
          providers: Provider[]
          refreshedAt: string
          streaming: TmdbItem[]
          cinema: TmdbItem[]
        }

        if (!ignore) {
          setTmdbRefreshedAt(data.refreshedAt)
          setTmdbError('')
          setGenreMap(data.genreMap)
          if (providersChanged(providers, data.providers)) {
            setProviders(data.providers)
          }
          setStreaming(data.streaming.length ? data.streaming : fallbackStreaming)
          setCinema(data.cinema)
          if (tmdbRefreshNonce > 0) setToast('Sources refreshed')
        }
      } catch (error) {
        if (!ignore) {
          setTmdbError(error instanceof Error ? error.message : 'Could not load TMDb data.')
          setStreaming(fallbackStreaming)
          setCinema([])
        }
      } finally {
        if (!ignore) setTmdbLoading(false)
      }
    }
    loadTmdb()
    return () => {
      ignore = true
    }
  }, [providers, setProviders, tmdbRefreshNonce])

  function showToast(message: string, undo?: () => void) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    setToastUndo(undo ?? null)
    if (message) {
      toastTimerRef.current = setTimeout(() => {
        setToast('')
        setToastUndo(null)
        toastTimerRef.current = null
      }, 5000)
    }
  }

  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast('')
    setToastUndo(null)
  }

  function requestConfirm(id: string, action: () => void) {
    if (pendingConfirmId === id) {
      setPendingConfirmId(null)
      if (pendingConfirmTimerRef.current) clearTimeout(pendingConfirmTimerRef.current)
      action()
    } else {
      if (pendingConfirmTimerRef.current) clearTimeout(pendingConfirmTimerRef.current)
      setPendingConfirmId(id)
      pendingConfirmTimerRef.current = setTimeout(() => setPendingConfirmId(null), 3000)
    }
  }

  function deriveRelationship(item: WatchingItem): Relationship {
    if (item.relationship) return item.relationship
    return statusToRelationship(item.status, item.done)
  }

  useEffect(() => {
    return () => {
      if (refreshPulseTimer.current) clearTimeout(refreshPulseTimer.current)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function loadWatchlist() {
      try {
        const response = await fetch('/api/media-guide/watchlist')
        if (!response.ok) throw new Error('Watchlist API unavailable.')
        const data = (await response.json()) as WatchingItem[]
        if (!ignore) {
          setWatching(data)
          setWatchlistSource('neon')
        }
      } catch {
        if (!ignore) setWatchlistSource('local')
      }
    }
    loadWatchlist()
    return () => {
      ignore = true
    }
  }, [setWatching])

  useEffect(() => {
    calendarGetToken().then((result) => {
      if (result.ok) setCalendarToken(result.data.token)
    })
  }, [])

  // Phase 1 artwork backfill: enrich DB rows that have tmdbId but no posterPath.
  // Runs once per session after the watchlist arrives from the server.
  useEffect(() => {
    if (watchlistSource !== 'neon') return
    const hasUnartworked = watching.some((w) => w.tmdbId && !w.posterPath)
    if (!hasUnartworked) return
    fetch('/api/media-guide/artwork-backfill', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((result: { enriched: number } | null) => {
        if (!result?.enriched) return
        // Re-fetch watchlist to pick up the newly-written poster_path values
        fetch('/api/media-guide/watchlist')
          .then((r) => (r.ok ? r.json() : null))
          .then((data: WatchingItem[] | null) => {
            if (data) setWatching(data)
          })
          .catch(() => undefined)
      })
      .catch(() => undefined)
  // Run once per session after watchlist data arrives (watchlistSource flips to 'neon')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistSource])

  useEffect(() => {
    if (!topItemTmdbId || showDetailCache[topItemTmdbId]) return
    fetch(`/api/media-guide/show-details?id=${topItemTmdbId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TmdbShowDetail | null) => {
        if (data) setShowDetailCache((c) => ({ ...c, [data.id]: data }))
      })
      .catch(() => undefined)
  // showDetailCache intentionally excluded — we only want to re-run when the top item changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topItemTmdbId])

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone)
    setInstallState(isInstalled ? 'installed' : 'manual')

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/runway-sw.js', { scope: '/' }).catch(() => undefined)
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallState('available')
    }

    function onAppInstalled() {
      setInstallPrompt(null)
      setInstallState('installed')
      setToast('Runway installed')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function loadRecommendations() {
      try {
        const response = await fetch('/api/media-guide/recommendations')
        if (!response.ok) throw new Error('Recommendations API unavailable.')
        const data = (await response.json()) as { lists: RecommendationList[]; items: RecommendationItem[] }
        if (!ignore) {
          setRecommendationLists(data.lists)
          setRecommendationItems(data.items)
        }
      } catch {
        if (!ignore) {
          setRecommendationLists([])
          setRecommendationItems([])
        }
      }
    }
    loadRecommendations()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function loadSuggestions() {
      try {
        const response = await fetch('/api/media-guide/suggestions')
        if (!response.ok) return
        const data = (await response.json()) as { suggestions: TmdbItem[] }
        if (!ignore) setSuggestions(data.suggestions)
      } catch {
        // suggestions are best-effort
      }
    }
    loadSuggestions()
    return () => {
      ignore = true
    }
  }, [recommendationItems])

  function toggleProvider(label: string) {
    setProviders((current) =>
      current.map((provider) =>
        provider.label === label ? { ...provider, enabled: !provider.enabled } : provider,
      ),
    )
  }

  function toggleFavoriteChannel(channelId: string) {
    setFavoriteChannelIds((current) => {
      const next = new Set(current ?? effectiveFavoriteChannelIds)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return Array.from(next)
    })
  }

  function resetFavoriteChannels() {
    setFavoriteChannelIds(null)
    setChannelMode('favorites')
    setChannelFilter('all')
  }

  async function generateCalendarToken() {
    setCalendarTokenLoading(true)
    const result = await calendarGenerateToken()
    setCalendarTokenLoading(false)
    if (result.ok) {
      setCalendarToken(result.data.token)
    } else {
      setToast(result.error)
    }
  }

  function refreshSources() {
    setToast('Refreshing sources...')
    setRefreshPulse(true)
    if (refreshPulseTimer.current) clearTimeout(refreshPulseTimer.current)
    refreshPulseTimer.current = setTimeout(() => setRefreshPulse(false), 900)
    setTmdbRefreshNonce((current) => current + 1)
  }

  async function persistWatchingItem(item: WatchingItem, onSaved?: (saved: WatchingItem) => void) {
    if (watching.some((row) => normalizeTitle(row.title) === normalizeTitle(item.title))) {
      setToast(`${item.title} is already in My List`)
      return
    }

    setWatching((current) => [item, ...current])
    const result = await watchlistAdd(item)
    if (!result.ok) {
      setWatching((current) => current.filter((row) => row.id !== item.id))
      showToast(result.error)
      setWatchlistSource('local')
      return
    }
    const saved = result.data as WatchingItem
    setWatching((current) => current.map((row) => (row.id === item.id ? saved : row)))
    setWatchlistSource('neon')
    showToast(`${item.title} added`, () => removeWatching(saved.id))
    onSaved?.(saved)
  }

  async function addWatching(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    if (!title) return
    const item: WatchingItem = {
      id: crypto.randomUUID(),
      title,
      service: String(data.get('service') ?? 'TV'),
      nextEpisode: String(data.get('nextEpisode') || new Date().toISOString().slice(0, 10)),
      cadence: String(data.get('cadence') || 'Weekly'),
      notes: String(data.get('notes') ?? ''),
      type: String(data.get('type') || 'show') as WatchItemType,
      userRating: null,
      lastWatchedAt: null,
      watchedCount: 0,
      status: String(data.get('status') || 'watching') as WatchStatus,
      done: String(data.get('status') || 'watching') === 'completed',
    }
    await persistWatchingItem(item)
    event.currentTarget.reset()
  }

  async function toggleWatching(item: WatchingItem) {
    const nextStatus = getWatchStatus(item) === 'completed' ? 'watching' : 'completed'
    await updateWatchingStatus(item, nextStatus)
  }

  async function updateWatchingStatus(item: WatchingItem, status: WatchStatus) {
    const nextDone = status === 'completed'
    await updateWatchingItem(item, { done: nextDone, status })
  }

  async function markWatched(item: WatchingItem, detail?: TmdbShowDetail) {
    const nextStatus = item.type === 'film' ? 'completed' : 'watching'
    const priorWatchedCount = item.watchedCount ?? 0
    const priorLastWatchedAt = item.lastWatchedAt ?? null
    const priorDone = item.done
    const priorStatus = item.status ?? 'watching'
    const priorSeason = item.currentSeason ?? 1
    const priorEpisode = item.currentEpisode ?? 0

    let nextSeason = priorSeason
    let nextEpisode = priorEpisode
    let caughtUp = false

    if (detail && item.type !== 'film' && item.type !== 'sport') {
      const currentSeasonInfo = detail.seasons.find((s) => s.seasonNumber === priorSeason)
      if (currentSeasonInfo && priorEpisode < currentSeasonInfo.episodeCount) {
        nextEpisode = priorEpisode + 1
      } else {
        const nextSeasonInfo = detail.seasons.find((s) => s.seasonNumber === priorSeason + 1)
        if (nextSeasonInfo) { nextSeason = priorSeason + 1; nextEpisode = 1 }
      }
      const lastSeason = detail.seasons[detail.seasons.length - 1]
      if (lastSeason && nextSeason >= lastSeason.seasonNumber && nextEpisode >= lastSeason.episodeCount) {
        caughtUp = true
      }
    }

    await updateWatchingItem(item, {
      done: nextStatus === 'completed',
      lastWatchedAt: formatIrelandDate(new Date()),
      status: nextStatus,
      watchedCount: priorWatchedCount + 1,
      currentSeason: nextSeason,
      currentEpisode: nextEpisode,
    })

    const toastMsg = caughtUp
      ? `${item.title} — all caught up`
      : item.type === 'film' ? `${item.title} watched` : `${item.title} — episode watched`

    const itemId = item.id
    showToast(toastMsg, async () => {
      if (caughtUp) {
        const timer = caughtUpTimerRef.current[itemId]
        if (timer) { clearTimeout(timer); delete caughtUpTimerRef.current[itemId] }
        setCaughtUpIds((prev) => { const s = new Set(prev); s.delete(itemId); return s })
      }
      await updateWatchingItem(item, {
        done: priorDone,
        lastWatchedAt: priorLastWatchedAt,
        status: priorStatus,
        watchedCount: priorWatchedCount,
        currentSeason: priorSeason,
        currentEpisode: priorEpisode,
      })
    })

    if (caughtUp) {
      setCaughtUpIds((prev) => new Set([...prev, itemId]))
      const timer = setTimeout(async () => {
        delete caughtUpTimerRef.current[itemId]
        setWatching((current) =>
          current.map((row) =>
            row.id === itemId ? { ...row, relationship: 'finished' as Relationship, status: 'completed', done: true } : row,
          ),
        )
        const result = await watchlistSetRelationship(itemId, 'finished')
        if (result.ok) {
          setWatching((current) => current.map((row) => row.id === itemId ? (result.data as WatchingItem) : row))
          if (!completionDismissed.includes(itemId)) {
            setCompletionPrompt(result.data as WatchingItem)
          }
        }
        setCaughtUpIds((prev) => { const s = new Set(prev); s.delete(itemId); return s })
      }, 2300)
      caughtUpTimerRef.current[itemId] = timer
    }
  }

  async function updateWatchingRating(item: WatchingItem, userRating: number) {
    await updateWatchingItem(item, { userRating }, `${item.title} rated ${userRating} stars`)
  }

  async function updateEpisode(item: WatchingItem, season: number, episode: number) {
    await updateWatchingItem(item, { currentSeason: season, currentEpisode: episode })
  }

  async function updateWatchingItem(
    item: WatchingItem,
    patch: Partial<Pick<WatchingItem, 'done' | 'lastWatchedAt' | 'status' | 'userRating' | 'watchedCount' | 'currentSeason' | 'currentEpisode' | 'tmdbId' | 'leavingDate'>>,
    successMessage?: string,
  ) {
    setWatching((current) =>
      current.map((row) => (row.id === item.id ? { ...row, ...patch } : row)),
    )
    const result = await watchlistUpdate({ id: item.id, ...patch })
    if (!result.ok) {
      setWatching((current) => current.map((row) => (row.id === item.id ? item : row)))
      setToast(result.error)
      setWatchlistSource('local')
      return
    }
    setWatching((current) => current.map((row) => (row.id === item.id ? (result.data as WatchingItem) : row)))
    setWatchlistSource('neon')
    if (successMessage) setToast(successMessage)
  }

  async function removeWatching(id: string) {
    const prior = watching.find((row) => row.id === id)
    setWatching((current) => current.filter((row) => row.id !== id))
    const result = await watchlistRemove(id)
    if (!result.ok) {
      if (prior) setWatching((current) => [prior, ...current])
      showToast(result.error)
      setWatchlistSource('local')
      return
    }
    setWatchlistSource('neon')
  }

  async function addRecommendation(item: TmdbItem, status: RecommendationItem['status']) {
    const titleStr = item.title ?? item.name ?? 'Untitled'
    const result = await recommendationsAddItem({
      listId: null,
      tmdbId: item.id,
      mediaType: item.media_type ?? (item.name ? 'tv' : 'movie'),
      status,
      title: titleStr,
      service: item.provider ?? 'Streaming',
      posterPath: item.poster_path,
      overview: item.overview,
    })
    if (!result.ok) {
      setToast(result.error)
      return
    }
    if ((status === 'favorite' || status === 'recommend') && discoveryStatusFilter === 'unselected') {
      setDiscoveryStatusFilter('all')
    }
    const saved = result.data as RecommendationItem
    setRecommendationItems((current) => [saved, ...current])
    showToast(statusLabel(status, titleStr), async () => {
      await recommendationsRemoveItem(saved.id)
      setRecommendationItems((current) => current.filter((r) => r.id !== saved.id))
    })
  }

  function toggleHiddenGenre(id: number) {
    setHiddenGenreIds((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]))
    setToast(hiddenGenreIds.includes(id) ? 'Category restored' : 'Category hidden')
  }

  async function createRecommendationList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    if (!name) return

    const result = await recommendationsCreateList(name)
    if (!result.ok) { setToast(result.error); return }
    setRecommendationLists((current) => [result.data as RecommendationList, ...current])
    event.currentTarget.reset()
  }

  async function renameRecommendationList(list: RecommendationList, name: string) {
    const nextName = name.trim()
    if (!nextName || nextName === list.name) return
    setRecommendationLists((current) =>
      current.map((item) => (item.id === list.id ? { ...item, name: nextName } : item)),
    )
    const result = await recommendationsRenameList(list.id, nextName)
    if (!result.ok) {
      setRecommendationLists((current) => current.map((item) => (item.id === list.id ? list : item)))
      setToast(result.error)
      return
    }
    setRecommendationLists((current) => current.map((item) => (item.id === result.data.id ? (result.data as RecommendationList) : item)))
  }

  async function moveRecommendationItem(itemId: string, listId: string) {
    const nextListId = listId || null
    const prior = recommendationItems.find((item) => item.id === itemId)
    setRecommendationItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, listId: nextListId } : item)),
    )
    const result = await recommendationsMoveItem(itemId, nextListId)
    if (!result.ok) {
      if (prior) setRecommendationItems((current) => current.map((item) => (item.id === itemId ? prior : item)))
      setToast(result.error)
      return
    }
    setRecommendationItems((current) => current.map((item) => (item.id === result.data.id ? (result.data as RecommendationItem) : item)))
  }

  async function removeRecommendationItem(id: string) {
    const prior = recommendationItems.find((item) => item.id === id)
    setRecommendationItems((current) => current.filter((item) => item.id !== id))
    const result = await recommendationsRemoveItem(id)
    if (!result.ok) {
      if (prior) setRecommendationItems((current) => [prior, ...current])
      setToast(result.error)
    }
  }

  async function removeRecommendationList(id: string) {
    const priorList = recommendationLists.find((list) => list.id === id)
    const priorItems = recommendationItems.filter((item) => item.listId === id)
    setRecommendationLists((current) => current.filter((list) => list.id !== id))
    setRecommendationItems((current) => current.filter((item) => item.listId !== id))
    const result = await recommendationsRemoveList(id)
    if (!result.ok) {
      if (priorList) setRecommendationLists((current) => [priorList, ...current])
      if (priorItems.length) setRecommendationItems((current) => [...priorItems, ...current])
      setToast(result.error)
    }
  }

  async function copyShareLink(slug: string) {
    const url = `${window.location.origin}/share/${slug}`
    await navigator.clipboard.writeText(url)
    setToast('Link copied')
  }

  async function installApp() {
    if (!installPrompt) {
      setToast('Use your browser menu to add Runway to your home screen')
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    setInstallState(choice.outcome === 'accepted' ? 'installed' : 'manual')
  }

  async function logout() {
    await fetch('/api/media-guide/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  async function openShowDetail(item: WatchingItem) {
    const closing = detailItemId === item.id

    const doOpen = () => {
      setDetailItemId(closing ? null : item.id)
      setTransitioningItemId(null)
    }

    // Fetch detail data first (so it's ready before transition)
    if (!closing && item.tmdbId && !showDetailCache[item.tmdbId]) {
      fetch(`/api/media-guide/show-details?id=${item.tmdbId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data: TmdbShowDetail | null) => {
          if (data) setShowDetailCache((cache) => ({ ...cache, [data.id]: data }))
        })
        .catch(() => undefined)
    }

    if (closing || !('startViewTransition' in document)) {
      doOpen()
      return
    }

    // Give the title its transition name in the OLD state
    flushSync(() => setTransitioningItemId(item.id))

    document.startViewTransition(() => {
      flushSync(doOpen)
    })
  }

  async function handleEpisodeUpdate(item: WatchingItem, season: number, episode: number) {
    const detail = item.tmdbId ? showDetailCache[item.tmdbId] : undefined
    const priorSeason = item.currentSeason ?? 1
    const priorEpisode = item.currentEpisode ?? 0
    const priorStatus = item.status ?? 'watching'
    const priorDone = item.done
    let isFinished = false
    if (detail) {
      const lastSeason = detail.seasons[detail.seasons.length - 1]
      if (lastSeason && season >= lastSeason.seasonNumber && episode >= lastSeason.episodeCount) {
        isFinished = true
      }
    }
    await updateEpisode(item, season, episode)
    if (isFinished && getWatchStatus(item) !== 'completed') {
      await updateWatchingStatus(item, 'completed')
      showToast(`${item.title} — finished`, async () => {
        await updateWatchingItem(item, { currentSeason: priorSeason, currentEpisode: priorEpisode, status: priorStatus, done: priorDone })
      })
    } else {
      const epLabel = formatEpisodeLabel(season, episode)
      showToast(`${item.title} — up to ${epLabel}`, async () => {
        await updateWatchingItem(item, { currentSeason: priorSeason, currentEpisode: priorEpisode })
      })
    }
  }

  async function updateLeavingDate(item: WatchingItem, date: string | null) {
    setWatching((current) =>
      current.map((row) => (row.id === item.id ? { ...row, leavingDate: date } : row)),
    )
    const result = await watchlistUpdate({ id: item.id, leavingDate: date })
    if (result.ok) {
      setWatching((current) => current.map((row) => (row.id === item.id ? (result.data as WatchingItem) : row)))
    }
    // optimistic update stands on failure — low-stakes field
  }

  async function transitionRelationship(item: WatchingItem, to: Relationship) {
    const from = deriveRelationship(item)
    if (!isLegalTransition(from, to)) return

    if (to === 'none') {
      // "Remove" — uses two-tap confirm at the call site
      return
    }

    const { status, done } = relationshipToStatus(to)
    const priorRelationship = from
    const priorStatus = item.status ?? 'watching'
    const priorDone = item.done

    setWatching((current) =>
      current.map((row) => (row.id === item.id ? { ...row, relationship: to, status: status as WatchStatus, done } : row)),
    )
    const result = await watchlistSetRelationship(item.id, to)
    if (!result.ok) {
      setWatching((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, relationship: priorRelationship, status: priorStatus, done: priorDone } : row,
        ),
      )
      showToast(result.error)
      return
    }
    setWatching((current) =>
      current.map((row) => (row.id === item.id ? (result.data as WatchingItem) : row)),
    )
    showToast(relationshipLabel(to), async () => {
      setWatching((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, relationship: priorRelationship, status: priorStatus, done: priorDone } : row,
        ),
      )
      await watchlistSetRelationship(item.id, priorRelationship)
    })
    if (to === 'finished' && !completionDismissed.includes(item.id)) {
      setCompletionPrompt(result.data as WatchingItem)
    }
  }

  async function seenIt(item: WatchingItem, tmdbDetail?: { seasons: { seasonNumber: number; episodeCount: number }[] }) {
    const lastSeason = tmdbDetail?.seasons[tmdbDetail.seasons.length - 1]
    const seenPatch: Partial<WatchingItem> = {
      relationship: 'finished',
      status: 'completed',
      done: true,
      lastWatchedAt: formatIrelandDate(new Date()),
    }
    if (lastSeason) {
      seenPatch.currentSeason = lastSeason.seasonNumber
      seenPatch.currentEpisode = lastSeason.episodeCount
    }

    const priorStatus = item.status ?? 'watching'
    const priorDone = item.done
    const priorRelationship = deriveRelationship(item)
    const priorSeason = item.currentSeason
    const priorEpisode = item.currentEpisode

    setWatching((current) =>
      current.map((row) => (row.id === item.id ? { ...row, ...seenPatch } : row)),
    )
    const result = await watchlistUpdate({ id: item.id, ...seenPatch })
    if (!result.ok) {
      setWatching((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, relationship: priorRelationship, status: priorStatus as WatchStatus, done: priorDone } : row,
        ),
      )
      showToast(result.error)
      return
    }
    setWatching((current) => current.map((row) => (row.id === item.id ? (result.data as WatchingItem) : row)))
    setWatchlistSource('neon')
    showToast(`${item.title} — finished`, async () => {
      await watchlistUpdate({
        id: item.id,
        relationship: priorRelationship,
        status: priorStatus as WatchStatus,
        done: priorDone,
        currentSeason: priorSeason,
        currentEpisode: priorEpisode,
      })
      setWatching((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, relationship: priorRelationship, status: priorStatus as WatchStatus, done: priorDone, currentSeason: priorSeason, currentEpisode: priorEpisode }
            : row,
        ),
      )
      setCompletionPrompt(null)
    })
    if (!completionDismissed.includes(item.id)) setCompletionPrompt(result.data as WatchingItem)
  }

  async function seenItFromSearch(tmdbItem: TmdbItem) {
    const newItem: WatchingItem = {
      ...mediaToWatchingItem(tmdbItem),
      relationship: 'finished',
      status: 'completed',
      done: true,
      lastWatchedAt: formatIrelandDate(new Date()),
    }
    await persistWatchingItem(newItem, (saved) => {
      if (!completionDismissed.includes(saved.id)) setCompletionPrompt(saved)
    })
  }

  async function toggleFavourite(item: WatchingItem) {
    const wasFav = Boolean(item.favouritedAt)
    const nextFav = !wasFav
    const nextFavAt = nextFav ? new Date().toISOString() : null

    setWatching((current) =>
      current.map((row) => (row.id === item.id ? { ...row, favouritedAt: nextFavAt } : row)),
    )
    const result = await watchlistSetFavourite(item.id, nextFav)
    if (!result.ok) {
      setWatching((current) =>
        current.map((row) => (row.id === item.id ? { ...row, favouritedAt: item.favouritedAt ?? null } : row)),
      )
      showToast(result.error)
      return
    }
    setWatching((current) => current.map((row) => (row.id === item.id ? (result.data as WatchingItem) : row)))
    showToast(nextFav ? `${item.title} — favourited` : `${item.title} — unfavourited`, async () => {
      await toggleFavourite({ ...item, favouritedAt: nextFavAt })
    })
  }

  function addRecentSearch(q: string) {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((s) => s !== q)].slice(0, 5)
      return next
    })
  }

  function dismissCompletionPrompt() {
    if (completionPrompt) {
      setCompletionDismissed((prev) =>
        prev.includes(completionPrompt.id) ? prev : [...prev, completionPrompt.id],
      )
    }
    setCompletionPrompt(null)
  }

  async function recommendFromCompletion(item: WatchingItem, listId: string | null, note = '') {
    const result = await recommendationsAddItem({
      listId,
      tmdbId: item.tmdbId ?? null,
      mediaType: item.type === 'film' ? 'movie' : 'tv',
      status: 'recommend',
      title: item.title,
      service: item.service,
      posterPath: item.posterPath ?? null,
      overview: item.notes ?? '',
      note,
    })
    if (result.ok) {
      setRecommendationItems((current) => [result.data as RecommendationItem, ...current])
      showToast(`${item.title} recommended`)
    } else {
      showToast(result.error)
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Cmd+K or Ctrl+K — open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      // / — open search (only when no overlay is open)
      if (event.key === '/' && !showKeyboardHelp && !searchOpen) {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      switch (event.key) {
        case 'Escape':
          if (searchOpen) { setSearchOpen(false); return }
          if (showKeyboardHelp) { setShowKeyboardHelp(false); return }
          if (detailItemId) { setDetailItemId(null); return }
          break
        case '?':
          setShowKeyboardHelp((prev) => !prev)
          break
        case 'g':
          setTab('guide')
          break
        case '1':
          setTab('tonight')
          break
        case '2':
          setTab('runway')
          break
        case '3':
          setTab('library')
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [detailItemId, showKeyboardHelp, searchOpen])

  return (
    <main className="app-shell">
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          {toastUndo && (
            <button
              type="button"
              className="toast-undo"
              onClick={() => { toastUndo(); dismissToast() }}
            >
              Undo
            </button>
          )}
        </div>
      )}
      {completionPrompt && (() => {
        const liveItem = watching.find((i) => i.id === completionPrompt.id) ?? completionPrompt
        return (
          <CompletionPromptCard
            item={liveItem}
            lists={recommendationLists}
            onFavourite={() => { void toggleFavourite(liveItem) }}
            onRecommend={(listId, note) => { void recommendFromCompletion(liveItem, listId, note); dismissCompletionPrompt() }}
            onDismiss={dismissCompletionPrompt}
          />
        )
      })()}
      {searchOpen && (
        <SearchOverlay
          watching={watching}
          recentSearches={recentSearches}
          trackedTitleSet={trackedTitleSet}
          onClose={() => setSearchOpen(false)}
          onWatchlist={(item) => { persistWatchingItem({ ...mediaToWatchingItem(item), relationship: 'watchlisted', status: 'planned', done: false }); setSearchOpen(false) }}
          onTrack={(item) => { persistWatchingItem(mediaToWatchingItem(item)); setSearchOpen(false) }}
          onSeen={(item) => { seenItFromSearch(item); setSearchOpen(false) }}
          onAddRecent={addRecentSearch}
          onOpenLibraryItem={(id) => { setTab('library'); setDetailItemId(id); setSearchOpen(false) }}
        />
      )}
      {showKeyboardHelp && (
        <div className="keyboard-overlay" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setShowKeyboardHelp(false)}>
          <div className="keyboard-overlay-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="keyboard-overlay-title">Keyboard shortcuts</h2>
            <dl className="keyboard-shortcut-list">
              <div><dt><kbd>/</kbd> or <kbd>⌘K</kbd></dt><dd>Search</dd></div>
              <div><dt><kbd>1</kbd></dt><dd>Dashboard</dd></div>
              <div><dt><kbd>2</kbd></dt><dd>Runway</dd></div>
              <div><dt><kbd>3</kbd></dt><dd>Library</dd></div>
              <div><dt><kbd>G</kbd></dt><dd>Guide</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Close panel</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>This overlay</dd></div>
            </dl>
            <button type="button" className="ep-catchup-dismiss keyboard-overlay-close" onClick={() => setShowKeyboardHelp(false)}>×</button>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="topbar-brand">
          <h1 className="topbar-wordmark">Runway</h1>
        </div>
        <nav className="tabs" aria-label="Guide views">
          <TabButton active={tab === 'tonight'} icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => setTab('tonight')} />
          <TabButton active={tab === 'runway'} icon={<Sparkles size={18} />} label="Runway" onClick={() => setTab('runway')} />
          <TabButton active={tab === 'library'} icon={<Star size={18} />} label="Library" onClick={() => setTab('library')} />
        </nav>
        <div className="topbar-actions">
          <button
            className="icon-button search-icon-btn"
            type="button"
            aria-label="Search (⌘K)"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={20} />
          </button>
          <button className={tab === 'guide' ? 'icon-button active-icon' : 'icon-button'} type="button" aria-label="TV Guide" onClick={() => setTab('guide')}>
            <Tv size={20} />
          </button>
          <button className={tab === 'settings' ? 'icon-button active-icon' : 'icon-button'} type="button" aria-label="Settings" onClick={() => setTab('settings')}>
            <Settings size={20} />
          </button>
        </div>
      </header>


      {tab === 'tonight' && (
        <section className="view dashboard">
          <div className={heroBackdropPath ? 'dashboard-hero-wrap has-backdrop' : 'dashboard-hero-wrap'}>

            {heroBackdropPath && (
              <div className="dashboard-hero-bg" aria-hidden>
                <Image
                  key={heroBackdropPath}
                  src={`https://image.tmdb.org/t/p/w1280${heroBackdropPath}`}
                  alt=""
                  width={1280}
                  height={720}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  priority
                />
              </div>
            )}
            {/* Greeting */}
            <div className="dashboard-greeting">
              <h2 className="greeting-date">{formatGreeting(now)}</h2>
              {mastheadLine && <p className="greeting-masthead">{mastheadLine}</p>}
            </div>

            {/* Time-fit chips */}
            <div className="time-fit-bar" role="group" aria-label="How much time do you have?">
              {(['any', '30min', '1hour', 'film'] as TimeFit[]).map((fit) => (
                <button
                  key={fit}
                  className={timeFit === fit ? 'time-fit-chip active' : 'time-fit-chip'}
                  type="button"
                  onClick={() => setTimeFit(fit)}
                >
                  {fit === 'any' ? 'Anything' : fit === '30min' ? '30 min' : fit === '1hour' ? '1 hour' : 'Film night'}
                </button>
              ))}
            </div>

            {/* Shortlist — absent when library populated but no candidates qualify */}
            {watching.length === 0 ? (
              <div className="dashboard-section">
                <div className="onboarding-card">
                  <MonitorPlay size={28} />
                  <h3>Track your first show</h3>
                  <p>Search for something you&apos;re watching and Runway will surface it here.</p>
                  <form
                    className="onboarding-search"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const val = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim()
                      if (val) { setDiscoveryQuery(val); setTab('runway') }
                    }}
                  >
                    <input name="q" placeholder="Search shows or films…" autoComplete="off" />
                    <button type="submit">Search</button>
                  </form>
                </div>
              </div>
            ) : shortlistItems.length > 0 ? (
              <div className="dashboard-section">
                <h2 className="dashboard-section-header">Shortlist</h2>
                <div className="shortlist-rail">
                  {shortlistItems.map((entry, index) => (
                    <ShortlistCard
                      key={entry.item.id}
                      entry={entry}
                      cardIndex={index}
                      showDetail={entry.item.tmdbId ? showDetailCache[entry.item.tmdbId] : undefined}
                      onMarkWatched={() => markWatched(entry.item, entry.item.tmdbId ? showDetailCache[entry.item.tmdbId] : undefined)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div> {/* end dashboard-hero-wrap */}

          {/* Continue watching — always shown when items exist; reconciliation replaced by this */}
          {inProgressShows.length > 0 && watching.length > 0 && (
            <div className="dashboard-section">
              <h2 className="dashboard-section-header">Continue watching</h2>
              <ContinueRail
                items={inProgressShows}
                showDetailCache={showDetailCache}
                caughtUpIds={caughtUpIds}
                onMarkWatched={markWatched}
              />
            </div>
          )}

          {/* DASHBOARD_MODULES — Phase 3: all optional modules gated off.
              Re-admit one at a time in Phase 5 once quality is proven. */}
          {DASHBOARD_MODULES.reconciliation && reconItems.length > 0 && (
            <ReconciliationCard
              items={reconItems}
              onConfirm={(item) => markWatched(item, item.tmdbId ? showDetailCache[item.tmdbId] : undefined)}
              onDismiss={() => setReconDismissed(true)}
            />
          )}

          {DASHBOARD_MODULES.comingUp && countdownGroups.length > 0 && (
            <div className="dashboard-section">
              <h2 className="dashboard-section-header">Coming up</h2>
              {countdownGroups.map((group) => (
                <div key={group.label} className="countdown-group">
                  <p className="countdown-group-label">{group.label}</p>
                  <div className="countdown-cards">
                    {group.items.map((item) => (
                      <CountdownCard
                        key={item.id}
                        chip={item.chip}
                        days={item.days}
                        dominantColour={item.dominantColour}
                        posterPath={item.posterPath}
                        title={item.title}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {DASHBOARD_MODULES.onTvTonight && (
            <div className="dashboard-section">
              <h2 className="dashboard-section-header">On TV tonight</h2>
              {tvTonightTracked.length > 0 ? (
                <div className="tv-tonight-list">
                  {tvTonightTracked.map((item) => {
                    const timeStatus = getProgrammeStatus(item, now.getTime())
                    return (
                      <div key={item.id} className="tv-tonight-row">
                        <span className="tv-tonight-time">{item.airtime || formatTime(item.airstamp)}</span>
                        <span className="tv-tonight-channel">{item.show.network?.name ?? item.show.webChannel?.name ?? ''}</span>
                        <span className="tv-tonight-title">{item.show.name}</span>
                        <div className="tv-tonight-chips">
                          {timeStatus === 'on-now' && <span className="status-chip chip-on-now">On now</span>}
                          {timeStatus === 'next' && <span className="status-chip chip-next">Next</span>}
                          <span className="status-chip chip-tracked">Tracked</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="tv-tonight-empty">
                  <span>Nothing of yours on TV tonight.</span>
                  <button type="button" className="quiet-link" onClick={() => setTab('guide')}>Full guide →</button>
                </div>
              )}
            </div>
          )}

          {DASHBOARD_MODULES.worthALook && suggestions.length > 0 && (
            <div className="dashboard-section">
              <h2 className="dashboard-section-header">Worth a look</h2>
              <div className="suggestion-strip">
                {suggestions.slice(0, 6).map((item) => (
                  <article key={`${item.media_type}-${item.id}`} className="suggestion-card">
                    {item.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                        alt=""
                        width={44}
                        height={64}
                        style={{ width: '44px', height: '64px', objectFit: 'cover', borderRadius: '6px', display: 'block' }}
                        placeholder="blur"
                        blurDataURL={makePosterBlur(null)}
                      />
                    ) : (
                      <div className="poster-fallback" style={{ width: '44px', height: '64px', borderRadius: '6px', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="poster-fallback-initial">{((item.title ?? item.name ?? '?')[0]).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="suggestion-info">
                      <strong>{item.title ?? item.name}</strong>
                      <span>{item.provider}</span>
                    </div>
                    <button
                      type="button"
                      className="icon-button quiet"
                      aria-label={`Track ${item.title ?? item.name}`}
                      onClick={() => persistWatchingItem(mediaToWatchingItem(item))}
                    >
                      <Plus size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'guide' && (
        <section className="view">
          <div className="tool-row guide-tool-row">
            <label className="field search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search TV" />
            </label>
            <div className="guide-tool-right">
              <div className="segmented-actions" aria-label="Listing time range">
                <button className={sportOnly ? 'active' : ''} type="button" onClick={() => setSportOnly((current) => !current)}>
                  Sport
                </button>
                <button
                  className={listingTimeMode === 'from_now' ? 'active' : ''}
                  type="button"
                  onClick={() => setListingTimeMode('from_now')}
                >
                  From now
                </button>
                <button
                  className={listingTimeMode === 'full_day' ? 'active' : ''}
                  type="button"
                  onClick={() => setListingTimeMode('full_day')}
                >
                  Full day
                </button>
              </div>
              <label className="field compact guide-date-field">
                <CalendarDays size={17} />
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </label>
            </div>
          </div>
          <div className="guide-channel-bar">
            <button
              type="button"
              className={channelFilter === 'all' ? 'guide-channel-chip active' : 'guide-channel-chip'}
              onClick={() => setChannelFilter('all')}
            >
              {channelMode === 'favorites' ? 'Favourites' : 'All'}
            </button>
            {(channelMode === 'favorites' ? favoriteChannels : channelOptions).slice(0, 24).map((channel) => (
              <button
                key={channel.id}
                type="button"
                className={channelFilter === channel.id ? 'guide-channel-chip active' : 'guide-channel-chip'}
                onClick={() => setChannelFilter((current) => current === channel.id ? 'all' : channel.id)}
              >
                {channel.name}
              </button>
            ))}
            <button type="button" className="guide-channel-chip guide-channel-settings" onClick={() => setTab('settings')}>
              <Settings size={13} />
            </button>
          </div>
          {tvError && <p className="notice error">{tvError}</p>}
          <div className="board-list">
            {tvLoading && <SkeletonRows />}
            {!tvLoading && (() => {
              const nowMs = now.getTime()
              let nowLineInserted = false
              return filteredTvItems.map((item, index) => {
                const startMs = Date.parse(item.airstamp)
                const isTracked = trackedTitleSet.has(normalizeTitle(item.show.name))
                const timeStatus = getProgrammeStatus(item, nowMs)
                const showNowLine = !nowLineInserted && startMs > nowMs
                if (showNowLine) nowLineInserted = true
                return (
                  <Fragment key={item.id}>
                    {showNowLine && <div className="now-line" ref={nowLineRef} />}
                    <article
                      className={isTracked ? 'programme programme--tracked' : 'programme'}
                      style={{ '--row-index': index } as CSSProperties}
                    >
                      <div className="time">
                        <strong>{item.airtime || formatTime(item.airstamp)}</strong>
                      </div>
                      <div className="programme-copy">
                        <span>{item.show.network?.name ?? item.show.webChannel?.name ?? 'Ireland TV'}</span>
                        <h2>{item.show.name}</h2>
                        <p>
                          {item.name}
                          {item.season ? ` · S${item.season}${item.number ? ` E${item.number}` : ''}` : ''}
                        </p>
                      </div>
                      <div className="programme-chips">
                        {timeStatus === 'on-now' && <span className="status-chip chip-on-now">On now</span>}
                        {timeStatus === 'next' && <span className="status-chip chip-next">Next</span>}
                        {isTracked && <span className="status-chip chip-tracked">Tracked</span>}
                      </div>
                      <button
                        className="programme-action"
                        type="button"
                        onClick={() =>
                          persistWatchingItem({
                            id: crypto.randomUUID(),
                            title: item.show.name,
                            service: item.show.network?.name ?? item.show.webChannel?.name ?? 'TV',
                            nextEpisode: selectedDate,
                            cadence: 'Weekly',
                            notes: item.name,
                            type: item.show.type === 'Movie' ? 'film' : 'show',
                            done: false,
                          })
                        }
                      >
                        {item.show.type === 'Movie' ? 'Watchlist' : 'Track'}
                      </button>
                    </article>
                  </Fragment>
                )
              })
            })()}
            {!tvLoading && filteredTvItems.length === 0 && (
              <EmptyState
                title={listingTimeMode === 'from_now' ? 'No more listings in this view' : 'No Irish EPG listings found today'}
                detail={
                  listingTimeMode === 'from_now'
                    ? 'Switch to Full day to see earlier programmes for the selected date.'
                    : 'The Sky Ireland XMLTV feed may not have programmes for this date yet.'
                }
              />
            )}
          </div>
        </section>
      )}

      {tab === 'runway' && (
        <section className="view">
          {/* Countdown stream */}
          {countdownGroups.map((group) => (
            <div key={group.label} className="countdown-group">
              <p className="countdown-group-label">{group.label}</p>
              <div className="countdown-cards">
                {group.items.map((item) => (
                  <CountdownCard
                    key={item.id}
                    chip={item.chip}
                    days={item.days}
                    dominantColour={item.dominantColour}
                    posterPath={item.posterPath}
                    title={item.title}
                  />
                ))}
              </div>
            </div>
          ))}
          {countdownGroups.length === 0 && !tmdbLoading && (
            <EmptyState title="Nothing upcoming" detail="Add shows to My List or load cinema releases to build the countdown." />
          )}

          {/* Watchlist poster grid */}
          {activeWatchingItems.length > 0 && (
            <div className="view-section">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">In progress</p>
                  <h2>Watching</h2>
                </div>
                <Star size={19} />
              </div>
              <WatchlistGrid
                items={activeWatchingItems}
                onMarkWatched={markWatched}
                onRemove={removeWatching}
              />
            </div>
          )}

          {/* Discover — streaming + cinema browse */}
          <div className="view-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Netflix, Prime, Apple TV+, Paramount+, Sky / NOW</p>
                <h2>Streaming in Ireland</h2>
                {tmdbRefreshedAt && <span className="refresh-note">Updated {formatTime(tmdbRefreshedAt)}</span>}
                {tmdbError && <span className="refresh-note error-note">{tmdbError}</span>}
              </div>
              <button
                className={
                  tmdbLoading || refreshPulse
                    ? 'icon-button quiet refresh-button refreshing'
                    : 'icon-button quiet refresh-button'
                }
                type="button"
                disabled={tmdbLoading}
                aria-label="Refresh streaming sources"
                onClick={refreshSources}
              >
                <RefreshCw className={tmdbLoading || refreshPulse ? 'spin' : ''} size={18} />
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="home-section">
                <p className="home-section-label">
                  <Sparkles size={14} />
                  Suggested for you
                </p>
                <div className="suggestion-strip">
                  {suggestions.slice(0, 6).map((item) => (
                    <article key={`${item.media_type}-${item.id}`} className="suggestion-card">
                      {item.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                          alt=""
                          width={44}
                          height={64}
                          style={{ width: '44px', height: '64px', objectFit: 'cover', borderRadius: '6px', display: 'block' }}
                          placeholder="blur"
                          blurDataURL={makePosterBlur(null)}
                        />
                      ) : (
                        <div className="poster-fallback">
                          <span className="poster-fallback-initial">{((item.title ?? item.name ?? '?')[0]).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="suggestion-info">
                        <strong>{item.title ?? item.name}</strong>
                        <span>{item.provider}</span>
                      </div>
                      <button
                        type="button"
                        className="icon-button quiet"
                        aria-label={`Track ${item.title ?? item.name}`}
                        onClick={() => persistWatchingItem(mediaToWatchingItem(item))}
                      >
                        <Plus size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
            <DiscoveryFilters
              discoveryGenreId={discoveryGenreId}
              discoveryMediaType={discoveryMediaType}
              discoveryQuery={discoveryQuery}
              discoveryStatusFilter={discoveryStatusFilter}
              genreOptions={genreOptions}
              onGenreChange={setDiscoveryGenreId}
              onMediaTypeChange={setDiscoveryMediaType}
              onPosterScaleChange={setPosterScale}
              onQueryChange={setDiscoveryQuery}
              onStatusFilterChange={setDiscoveryStatusFilter}
              posterScale={posterScale}
              showMediaType
            />
            <div className="provider-row">
              {providers.map((provider) => (
                <button
                  className={provider.enabled ? 'provider active' : 'provider'}
                  key={provider.label}
                  type="button"
                  onClick={() => toggleProvider(provider.label)}
                >
                  <Filter size={15} />
                  {provider.label}
                </button>
              ))}
            </div>
            <MediaGrid
              dominantColourByKey={dominantColourByKey}
              genreMap={genreMap}
              items={visibleStreamingItems}
              onAction={addRecommendation}
              onTrack={(item) => persistWatchingItem(mediaToWatchingItem(item))}
              posterScale={posterScale}
              statusByKey={discoveryStatusByKey}
              trackedTitleSet={trackedTitleSet}
            />
            {!tmdbLoading && visibleStreamingItems.length === 0 && (
              <EmptyState
                title="No titles for the selected services"
                detail="Turn a provider back on, restore hidden categories, or tap refresh."
              />
            )}
          </div>

          <div className="view-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Region IE</p>
                <h2>Movie Releases</h2>
              </div>
              <Clapperboard size={19} />
            </div>
            {cinema.length ? (
              <MediaGrid
                dominantColourByKey={dominantColourByKey}
                genreMap={genreMap}
                items={visibleCinemaItems}
                onAction={addRecommendation}
                onTrack={(item) => persistWatchingItem(mediaToWatchingItem(item))}
                posterScale={posterScale}
                statusByKey={discoveryStatusByKey}
                trackedTitleSet={trackedTitleSet}
              />
            ) : (
              <EmptyState title={tmdbError || 'TMDb releases will load once TMDB_API_KEY is available on the server'} />
            )}
          </div>
        </section>
      )}

      {tab === 'library' && (
        <section className="view">
          {inProgressShows.length > 0 && (
            <UpNextRail items={inProgressShows} showDetailCache={showDetailCache} caughtUpIds={caughtUpIds} onMarkWatched={markWatched} />
          )}
          <div className="library-filter-bar" role="group" aria-label="Filter your library">
            {([
              ['all', 'All'],
              ['watching', 'Watching'],
              ['watchlisted', 'Watchlist'],
              ['finished', 'Finished'],
              ['favourites', 'Favourites'],
              ['recommended', 'Recommended'],
              ['abandoned', 'Abandoned'],
            ] as [LibraryFilter, string][]).map(([value, label]) => {
              const count = libraryFilterCounts[value]
              return (
                <button
                  key={value}
                  type="button"
                  className={libraryFilter === value ? 'library-filter-chip active' : 'library-filter-chip'}
                  onClick={() => setLibraryFilter(value)}
                >
                  {label}
                  {count > 0 && <span className="library-filter-count">{count}</span>}
                </button>
              )
            })}
          </div>
          <form className="add-form" onSubmit={addWatching}>
            <input name="title" placeholder="Programme or film" required />
            <div className="form-grid">
              <input name="service" placeholder="Service" />
              <input name="nextEpisode" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="form-grid">
              <select name="type" defaultValue="show">
                <option value="show">TV show</option>
                <option value="film">Film</option>
                <option value="sport">Sport</option>
                <option value="other">Other</option>
              </select>
              <select name="cadence" defaultValue="Weekly">
                <option>Weekly</option>
                <option>Daily</option>
                <option>Monthly</option>
                <option>One-off</option>
                <option>Unknown</option>
              </select>
              <select name="status" defaultValue="watching">
                <option value="watching">Watching</option>
                <option value="waiting">Waiting for next series</option>
                <option value="planned">Plan to watch</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
              </select>
              <input name="notes" placeholder="Episode, season, note" />
            </div>
            <button className="primary-button" type="submit">
              <Plus size={18} />
              Add to My List
            </button>
          </form>
          <div className="calendar-panel">
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">Calendar</p>
                <h2>Upcoming dates</h2>
              </div>
              <CalendarDays size={18} />
            </div>
            <div className="calendar-list">
              {calendarEvents.map((item) => (
                <div className="calendar-item" key={item.id}>
                  <time>{formatShortDate(item.date)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                </div>
              ))}
              {!calendarEvents.length && <p className="muted-copy">Track shows or load cinema releases to fill the calendar.</p>}
            </div>
          </div>
          <div className="watch-list">
            {watchGroups.map((group) => (
              <section className="watch-group" key={group.status}>
                <div className="watch-group-heading">
                  <h2>{watchStatusLabel(group.status)}</h2>
                  <span>{group.items.length}</span>
                </div>
                {group.items.map((item, itemIndex) => {
                  const watchStatus = getWatchStatus(item)
                  const isExpanded = detailItemId === item.id
                  const isShow = item.type !== 'film' && item.type !== 'sport'
                  const showDetail = item.tmdbId ? showDetailCache[item.tmdbId] : undefined
                  const progressPct = showDetail && isShow ? computeWatchProgress(item, showDetail) : 0
                  const rel = deriveRelationship(item)
                  const isFav = Boolean(item.favouritedAt)
                  const isPendingRemove = pendingConfirmId === `remove-${item.id}`
                  return (
                    <div className={isExpanded ? 'watch-item-wrapper expanded' : 'watch-item-wrapper'} key={item.id} style={{ '--item-index': itemIndex } as CSSProperties}>
                      <article className={[watchStatus === 'completed' ? 'watch-item done' : 'watch-item', pulsingItemId === item.id ? 'pulse' : ''].filter(Boolean).join(' ')}>
                        <button
                          className="check"
                          type="button"
                          aria-label={`Mark ${item.title} completed`}
                          onClick={() => toggleWatching(item)}
                        >
                          {watchStatus === 'completed' && <Check size={16} />}
                        </button>
                        <div>
                          <h2
                            style={transitioningItemId === item.id ? { viewTransitionName: 'detail-title' } as CSSProperties : undefined}
                          >{item.title}</h2>
                          <p>
                            {item.service}
                            <span className="type-badge">{watchTypeLabel(item.type)}</span>
                          </p>
                          {/* Relationship toggle chips */}
                          <div className="rel-chip-bar" role="group" aria-label={`${item.title} status`}>
                            {(['watchlisted', 'tracking', 'finished', 'abandoned'] as Relationship[]).map((r) => (
                              <button
                                key={r}
                                type="button"
                                aria-pressed={rel === r}
                                className={rel === r ? 'rel-chip active' : 'rel-chip'}
                                onClick={() => { if (rel !== r) transitionRelationship(item, r) }}
                              >
                                {rel === r ? relationshipLabel(r) : relationshipActionLabel(r)}
                              </button>
                            ))}
                          </div>
                          <div className="watch-status-row">
                            <select
                              aria-label={`${item.title} watch status`}
                              value={watchStatus}
                              onChange={(event) => updateWatchingStatus(item, event.target.value as WatchStatus)}
                            >
                              <option value="planned">Plan to watch</option>
                              <option value="watching">Watching</option>
                              <option value="waiting">Waiting for next series</option>
                              <option value="completed">Completed</option>
                              <option value="dropped">Dropped</option>
                            </select>
                            <small>{item.cadence}</small>
                          </div>
                          {isShow && (
                            <div className="episode-tracker">
                              <span className="episode-label">
                                {formatEpisodeLabel(item.currentSeason, item.currentEpisode)}
                              </span>
                              <button
                                type="button"
                                className="ep-btn"
                                aria-label="Previous episode"
                                onClick={() => {
                                  const ep = (item.currentEpisode ?? 0) - 1
                                  if (ep < 0) {
                                    const s = Math.max(1, (item.currentSeason ?? 1) - 1)
                                    updateEpisode(item, s, 0)
                                  } else {
                                    updateEpisode(item, item.currentSeason ?? 1, ep)
                                  }
                                }}
                              >−</button>
                              <button
                                type="button"
                                className="ep-btn"
                                aria-label="Next episode"
                                onClick={() => updateEpisode(item, item.currentSeason ?? 1, (item.currentEpisode ?? 0) + 1)}
                              >+</button>
                              <button
                                type="button"
                                className="ep-btn"
                                aria-label="Next season"
                                onClick={() => updateEpisode(item, (item.currentSeason ?? 1) + 1, 1)}
                              >S+</button>
                            </div>
                          )}
                          {watchStatus === 'dropped' && (
                            <div className="abandoned-meta">
                              {item.lastWatchedAt
                                ? `Dropped after ${formatShortDate(item.lastWatchedAt)}`
                                : 'Dropped'}
                              <button
                                type="button"
                                className="pickup-btn"
                                onClick={() => transitionRelationship(item, 'tracking')}
                              >
                                ▶ Pick it back up
                              </button>
                            </div>
                          )}
                          <div className="watch-feedback-row">
                            <button type="button" onClick={() => markWatched(item, item.tmdbId ? showDetailCache[item.tmdbId] : undefined)}>
                              <Check size={14} />
                              {item.type === 'film' ? 'Watched' : 'Ep watched'}
                            </button>
                            <button
                              type="button"
                              aria-pressed={isFav}
                              className={isFav ? 'toggle-chip active' : 'toggle-chip'}
                              onClick={() => toggleFavourite(item)}
                            >
                              <Heart size={13} fill={isFav ? 'currentColor' : 'none'} />
                              {isFav ? 'Favourited' : 'Favourite'}
                            </button>
                            {item.recommendedAt && (
                              <span className="recommended-mark" title="You recommended this">
                                <Send size={11} />
                                Recommended
                              </span>
                            )}
                            <div className="star-rating" aria-label={`${item.title} rating`}>
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                  aria-label={`Rate ${item.title} ${rating} stars`}
                                  className={(item.userRating ?? 0) >= rating ? 'active' : ''}
                                  key={rating}
                                  type="button"
                                  onClick={() => updateWatchingRating(item, rating)}
                                >
                                  <Star size={14} fill="currentColor" />
                                </button>
                              ))}
                            </div>
                            {(item.watchedCount ?? 0) > 0 && (
                              <small>
                                {item.type === 'film' ? 'Watched' : `${item.watchedCount} ep${item.watchedCount === 1 ? '' : 's'} watched`}
                                {item.lastWatchedAt ? ` — last ${formatShortDate(item.lastWatchedAt)}` : ''}
                              </small>
                            )}
                          </div>
                          {item.notes && <span>{item.notes}</span>}
                          {isShow && progressPct > 0 && (
                            <div className="watch-progress-bar" style={{ '--pct': `${progressPct}%` } as CSSProperties} />
                          )}
                        </div>
                        <div className="date-pill">{formatShortDate(item.nextEpisode)}</div>
                        {isShow && (
                          <button
                            className={isExpanded ? 'icon-button quiet active' : 'icon-button quiet'}
                            type="button"
                            aria-label={isExpanded ? 'Close episode grid' : 'Open episode grid'}
                            onClick={() => openShowDetail(item)}
                          >
                            <ChevronRight size={17} style={isExpanded ? { transform: 'rotate(90deg)', transition: 'transform 180ms ease' } : { transition: 'transform 180ms ease' }} />
                          </button>
                        )}
                        <button
                          className={isPendingRemove ? 'icon-button quiet pending-confirm' : 'icon-button quiet'}
                          type="button"
                          aria-label={isPendingRemove ? `Confirm remove ${item.title}` : `Remove ${item.title}`}
                          onClick={() => requestConfirm(`remove-${item.id}`, () => removeWatching(item.id))}
                        >
                          {isPendingRemove ? <span className="confirm-label">Remove?</span> : <Trash2 size={17} />}
                        </button>
                      </article>
                      {isExpanded && (
                        <ShowDetailPanel
                          item={item}
                          showDetail={showDetail}
                          onUpdateEpisode={handleEpisodeUpdate}
                          onUpdateLeavingDate={updateLeavingDate}
                          onToggleFavourite={() => toggleFavourite(item)}
                        />
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
            {!watchGroups.length && <EmptyState title="My List is empty" detail="Track shows, films, or sports from the guide." />}
          </div>

          <div className="view-section">
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">Recommendation lists</p>
                <h2>Shared Lists</h2>
              </div>
              <ListPlus size={19} />
            </div>
            <form className="add-form" onSubmit={createRecommendationList}>
            <input name="name" placeholder="List name, e.g. Films for Dad" required />
            <button className="primary-button" type="submit">
              <ListPlus size={18} />
              Create Share List
            </button>
          </form>

          <div className="status-rail">
            <StatusBucket
              icon={<Eye size={17} />}
              items={recommendationItems.filter((item) => item.status === 'seen')}
              label="Seen"
              onRemove={removeRecommendationItem}
            />
            <StatusBucket
              icon={<Heart size={17} />}
              items={recommendationItems.filter((item) => item.status === 'favorite')}
              label="Favorites"
              onRemove={removeRecommendationItem}
            />
            <StatusBucket
              icon={<Send size={17} />}
              items={recommendationItems.filter((item) => item.status === 'recommend')}
              label="Recommended"
              onRemove={removeRecommendationItem}
            />
            <StatusBucket
              icon={<ThumbsDown size={17} />}
              items={recommendationItems.filter((item) => item.status === 'not_interested')}
              label="Not for me"
              onRemove={removeRecommendationItem}
            />
          </div>

          <div className="recommendation-lists">
            <article className="recommendation-list">
              <div className="list-heading">
                <div>
                  <p className="eyebrow">Main recommendations</p>
                  <h2>Inbox</h2>
                  <span>{recommendationItems.filter((item) => item.status === 'recommend' && !item.listId).length} unfiled recommendations</span>
                </div>
              </div>
              <div className="mini-list">
                {recommendationItems
                  .filter((item) => item.status === 'recommend' && !item.listId)
                  .map((item) => (
                    <RecommendationListItem
                      item={item}
                      key={item.id}
                      lists={recommendationLists}
                      onMove={moveRecommendationItem}
                      onRemove={removeRecommendationItem}
                    />
                  ))}
                {!recommendationItems.some((item) => item.status === 'recommend' && !item.listId) && (
                  <p className="muted-copy">Tap Recommend on Streaming or Cinema to add titles here first.</p>
                )}
              </div>
            </article>
            {recommendationLists.map((list) => {
              const listItems = recommendationItems.filter((item) => item.listId === list.id)
              return (
                <article className="recommendation-list" key={list.id}>
                  <div className="list-heading">
                    <div>
                      <p className="eyebrow">Share list</p>
                      <input
                        aria-label={`Rename ${list.name}`}
                        className="list-name-input"
                        defaultValue={list.name}
                        onBlur={(event) => renameRecommendationList(list, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur()
                        }}
                      />
                      <span>{listItems.length} recommendations</span>
                    </div>
                    <div className="list-actions">
                      <button type="button" onClick={() => copyShareLink(list.shareSlug)}>
                        <Copy size={16} />
                        Copy Link
                      </button>
                      <button type="button" onClick={() => removeRecommendationList(list.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mini-list">
                    {listItems.map((item) => (
                      <RecommendationListItem
                        item={item}
                        key={item.id}
                        lists={recommendationLists}
                        onMove={moveRecommendationItem}
                        onRemove={removeRecommendationItem}
                      />
                    ))}
                    {listItems.length === 0 && <p className="muted-copy">Move recommendations from the Inbox into this list.</p>}
                  </div>
                </article>
              )
            })}
            {recommendationLists.length === 0 && (
              <EmptyState title="Create a list for someone" detail="Then add titles from Streaming or Cinema and share the link." />
            )}
          </div>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <section className="view">
          <div className="settings-panel">
            <div className="settings-roadmap">
              <p className="eyebrow">Display</p>
              <h2>Listings</h2>
              <div className="settings-controls">
                <div>
                  <strong>Today listings</strong>
                  <span>Keep Today focused on what is still to come, or show the whole day.</span>
                </div>
                <div className="segmented-actions">
                  <button
                    className={listingTimeMode === 'from_now' ? 'active' : ''}
                    type="button"
                    onClick={() => setListingTimeMode('from_now')}
                  >
                    From now
                  </button>
                  <button
                    className={listingTimeMode === 'full_day' ? 'active' : ''}
                    type="button"
                    onClick={() => setListingTimeMode('full_day')}
                  >
                    Full day
                  </button>
                </div>
              </div>
              <div className="settings-controls">
                <div>
                  <strong>Home screen app</strong>
                  <span>
                    {installState === 'installed'
                      ? 'Installed as a standalone app.'
                      : installState === 'available'
                        ? 'Ready to install on this device.'
                        : 'Use your browser menu if the install button is unavailable.'}
                  </span>
                </div>
                <button
                  className="primary-button compact-action"
                  type="button"
                  disabled={installState === 'installed'}
                  onClick={installApp}
                >
                  <Download size={16} />
                  {installState === 'installed' ? 'Installed' : 'Install'}
                </button>
              </div>
            </div>
            <div className="settings-roadmap">
              <p className="eyebrow">Channels</p>
              <h2>Your channel list</h2>
              <div className="settings-controls">
                <span>{favoriteChannels.length || effectiveFavoriteChannelIds.length} favourites from {channelOptions.length || 'the'} channel roster</span>
                <div className="segmented-actions">
                  <button
                    className={channelMode === 'favorites' ? 'active' : ''}
                    type="button"
                    onClick={() => { setChannelMode('favorites'); setChannelFilter('all') }}
                  >
                    Favourites
                  </button>
                  <button
                    className={channelMode === 'all' ? 'active' : ''}
                    type="button"
                    onClick={() => { setChannelMode('all'); setChannelFilter('all') }}
                  >
                    All
                  </button>
                </div>
              </div>
              <div className="channel-chip-row">
                {(channelMode === 'favorites' ? favoriteChannels : channelOptions).slice(0, channelMode === 'favorites' ? 36 : 64).map((channel) => (
                  <div className={favoriteChannelSet.has(channel.id) ? 'channel-chip favorite' : 'channel-chip'} key={channel.id}>
                    <button className="channel-open" type="button" onClick={() => { setChannelFilter(channel.id); setTab('tonight') }}>
                      <Star size={14} fill={favoriteChannelSet.has(channel.id) ? 'currentColor' : 'none'} />
                      <span>{channel.name}</span>
                    </button>
                    <button
                      aria-label={`${favoriteChannelSet.has(channel.id) ? 'Remove' : 'Add'} ${channel.name} ${favoriteChannelSet.has(channel.id) ? 'from' : 'to'} favourites`}
                      className="chip-star"
                      type="button"
                      onClick={(event) => { event.stopPropagation(); toggleFavoriteChannel(channel.id) }}
                    >
                      {favoriteChannelSet.has(channel.id) ? 'On' : 'Add'}
                    </button>
                  </div>
                ))}
                {channelMode === 'favorites' && favoriteChannels.length === 0 && (
                  <p className="muted-copy">No favourite channels yet. Switch to All and star the channels you watch.</p>
                )}
              </div>
              <div className="channel-actions">
                <button type="button" onClick={resetFavoriteChannels}>
                  Reset starter Sky list
                </button>
              </div>
            </div>
            <div className="settings-roadmap">
              <p className="eyebrow">Services</p>
              <h2>Your streaming services</h2>
              <p className="settings-help">Active services are surfaced in suggestions and the "Worth a look" section.</p>
              <div className="provider-settings-row">
                {providers.map((provider) => (
                  <button
                    key={provider.label}
                    type="button"
                    className={provider.enabled ? 'provider-settings-chip active' : 'provider-settings-chip'}
                    onClick={() => toggleProvider(provider.label)}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </div>
            <h2>Data Sources</h2>
            <p>
              TV uses the Ireland XMLTV EPG feed. Streaming and cinema use TMDb with watch region IE through the protected server
              API.
            </p>
            <div className="source-list">
              <div>
                <strong>Sky TV</strong>
                <span>Direct Sky EPG data is not public; use TVMaze now or connect a licensed EPG table later.</span>
              </div>
              <ChevronRight size={18} />
            </div>
            <div className="source-list">
              <div>
                <strong>Database ready</strong>
                <span>
                  Watchlist storage: {watchlistSource === 'neon' ? 'Neon database' : watchlistSource === 'syncing' ? 'checking Neon' : 'local fallback'}
                </span>
              </div>
              <ChevronRight size={18} />
            </div>
            <div className="source-list">
              <div>
                <strong>App version</strong>
                <span>Runway v{appVersion}{process.env.NEXT_PUBLIC_COMMIT ? ` · build ${process.env.NEXT_PUBLIC_COMMIT}` : ''}</span>
              </div>
              <ChevronRight size={18} />
            </div>
            <div className="settings-roadmap">
              <p className="eyebrow">Taste profile</p>
              <h2>Hide categories</h2>
              <div className="genre-preferences">
                {genreOptions.map((genre) => (
                  <button
                    className={hiddenGenreIds.includes(genre.id) ? 'genre-chip hidden' : 'genre-chip'}
                    key={genre.id}
                    type="button"
                    onClick={() => toggleHiddenGenre(genre.id)}
                  >
                    {genre.name}
                  </button>
                ))}
                {!genreOptions.length && <span>Categories appear after TMDb loads.</span>}
              </div>
            </div>
            <div className="settings-roadmap">
              <p className="eyebrow">Product roadmap</p>
              <h2>Best next upgrades</h2>
              <div className="roadmap-lanes">
                <div>
                  <strong>Now</strong>
                  <span>Calendar view for episodes and cinema releases</span>
                  <span>Watch statuses: watching, waiting, completed, dropped</span>
                  <span>Per-person notes and ratings on shared lists</span>
                </div>
                <div>
                  <strong>Next</strong>
                  <span>Push reminders for next episodes</span>
                  <span>Better taste profile from seen, favorites, and genres</span>
                  <span>Dashboard for hours, genres, ratings, and service usage</span>
                </div>
                <div>
                  <strong>Later</strong>
                  <span>Conversational AI search and recommendations</span>
                  <span>Tags for mood, language, runtime, theme, and format</span>
                  <span>Trakt or JustWatch-style availability sync</span>
                </div>
              </div>
            </div>
            <div className="settings-roadmap">
              <p className="eyebrow">Integration</p>
              <h2>Calendar feed</h2>
              <p className="settings-help">Subscribe in Google Calendar or Apple Calendar to see upcoming episodes, releases, and leaving-soon alerts.</p>
              {calendarToken ? (
                <div className="calendar-feed-row">
                  <code className="calendar-url-display">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/${calendarToken}.ics` : `/api/calendar/${calendarToken}.ics`}
                  </code>
                  <div className="calendar-feed-actions">
                    <button
                      type="button"
                      className="ep-catchup-btn"
                      onClick={() => {
                        const url = `${window.location.origin}/api/calendar/${calendarToken}.ics`
                        navigator.clipboard.writeText(url).then(() => setToast('Calendar URL copied'))
                      }}
                    >
                      <Copy size={12} />
                      Copy URL
                    </button>
                    <button
                      type="button"
                      className="ep-catchup-btn secondary"
                      disabled={calendarTokenLoading}
                      onClick={generateCalendarToken}
                    >
                      <RefreshCw size={12} />
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="ep-catchup-btn"
                  disabled={calendarTokenLoading}
                  onClick={generateCalendarToken}
                >
                  <CalendarDays size={12} />
                  {calendarTokenLoading ? 'Generating…' : 'Generate calendar URL'}
                </button>
              )}
            </div>
            <button className="primary-button secondary-action" type="button" onClick={logout}>
              Sign Out
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

function ShortlistCard({
  entry,
  cardIndex,
  showDetail,
  onMarkWatched,
}: {
  entry: ShortlistEntry
  cardIndex: number
  showDetail: TmdbShowDetail | undefined
  onMarkWatched: () => void
}) {
  const { item, reason, action } = entry
  const progress = showDetail && item.type !== 'film' && item.type !== 'sport'
    ? computeWatchProgress(item, showDetail)
    : 0
  return (
    <article className="shortlist-card" style={{ '--card-index': cardIndex } as CSSProperties}>
      <div className="shortlist-card-poster">
        {item.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
            alt=""
            width={342}
            height={513}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            placeholder="blur"
            blurDataURL={makePosterBlur(null)}
          />
        ) : (
          <div className="poster-fallback" style={{ width: '100%', height: '100%', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            <span className="poster-fallback-initial">{(item.title[0] ?? '?').toUpperCase()}</span>
            <span className="poster-fallback-title">{item.title}</span>
          </div>
        )}
        {progress > 0 && (
          <div className="shortlist-progress-track">
            <div className="shortlist-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="shortlist-card-info">
        <span className="shortlist-card-service">{item.service}</span>
        <h3 className="shortlist-card-title">{item.title}</h3>
        <p className="shortlist-card-reason">{reason}</p>
        <button type="button" className="shortlist-card-action" onClick={onMarkWatched}>
          <Check size={13} />
          {action}
        </button>
      </div>
    </article>
  )
}

function ContinueRail({
  items,
  showDetailCache,
  caughtUpIds,
  onMarkWatched,
}: {
  items: WatchingItem[]
  showDetailCache: Record<number, TmdbShowDetail>
  caughtUpIds: Set<string>
  onMarkWatched: (item: WatchingItem, detail?: TmdbShowDetail) => void
}) {
  return (
    <div className="continue-rail">
      {items.slice(0, 10).map((item) => {
        const isCaughtUp = caughtUpIds.has(item.id)
        const showDetail = item.tmdbId ? showDetailCache[item.tmdbId] : undefined
        const progress = showDetail && item.type !== 'film' && item.type !== 'sport'
          ? computeWatchProgress(item, showDetail)
          : 0
        const epLabel =
          item.type !== 'film' && item.type !== 'sport'
            ? formatEpisodeLabel(item.currentSeason, item.currentEpisode)
            : null
        const avgRuntime = showDetail?.episodeRunTime?.length
          ? Math.round(showDetail.episodeRunTime.reduce((a, b) => a + b, 0) / showDetail.episodeRunTime.length)
          : null
        const runtime = avgRuntime ? `${avgRuntime} min` : null
        return (
          <div key={item.id} className={isCaughtUp ? 'continue-card caught-up' : 'continue-card'}>
            <div className="continue-card-poster">
              {item.posterPath ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                  alt=""
                  width={185}
                  height={278}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  placeholder="blur"
                  blurDataURL={makePosterBlur(null)}
                />
              ) : (
                <div className="poster-fallback" style={{ width: '100%', height: '100%', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="poster-fallback-initial">{(item.title[0] ?? '?').toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="continue-card-body">
              <div className="continue-card-info">
                {isCaughtUp ? (
                  <span className="continue-card-ep caught-up-label">Caught up ✓</span>
                ) : (
                  epLabel && <span key={epLabel} className="continue-card-ep">{epLabel}</span>
                )}
                <span className="continue-card-title">{item.title}</span>
                {runtime && <span className="continue-card-runtime">{runtime}</span>}
              </div>
              {!isCaughtUp && (
                <button type="button" className="continue-card-mark" onClick={() => onMarkWatched(item, showDetail)}>
                  <Check size={11} />
                  {item.type === 'film' ? 'Watched' : 'Ep watched'}
                </button>
              )}
            </div>
            <div className="continue-card-progress-track">
              <div className="continue-card-progress-fill" style={{ width: isCaughtUp ? '100%' : `${Math.max(2, progress)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReconciliationCard({
  items,
  onConfirm,
  onDismiss,
}: {
  items: WatchingItem[]
  onConfirm: (item: WatchingItem) => void
  onDismiss: () => void
}) {
  return (
    <div className="recon-card">
      <div className="recon-card-header">
        <span className="recon-card-label">Catch me up — did you watch these?</span>
        <button type="button" className="icon-button quiet" onClick={onDismiss} aria-label="Dismiss">
          <span aria-hidden>×</span>
        </button>
      </div>
      <div className="recon-list">
        {items.slice(0, 4).map((item) => {
          const epLabel =
            item.type !== 'film' && item.type !== 'sport'
              ? formatEpisodeLabel(item.currentSeason, item.currentEpisode)
              : null
          return (
            <div key={item.id} className="recon-row">
              <div className="recon-row-info">
                <span className="recon-row-title">{item.title}</span>
                {epLabel && <span className="recon-row-ep">{epLabel}</span>}
              </div>
              <button type="button" className="recon-confirm" onClick={() => onConfirm(item)}>
                <Check size={12} />
                Watched
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CountdownCard({
  chip,
  days,
  dominantColour,
  posterPath,
  title,
}: {
  chip: string
  days: number
  dominantColour: string | null
  posterPath: string | null
  title: string
}) {
  const isUrgent = days <= 7
  return (
    <div className="countdown-card">
      {posterPath ? (
        <Image
          src={`https://image.tmdb.org/t/p/w185${posterPath}`}
          alt=""
          width={185}
          height={278}
          sizes="130px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          placeholder="blur"
          blurDataURL={makePosterBlur(dominantColour)}
        />
      ) : (
        <div className="countdown-card-fallback poster-fallback">
          <span className="poster-fallback-title">{title}</span>
        </div>
      )}
      <div className="countdown-card-info">
        <p className="countdown-card-title">{title}</p>
        <span className={isUrgent ? 'countdown-chip countdown-chip--urgent' : 'countdown-chip'}>{chip}</span>
      </div>
    </div>
  )
}

function WatchlistGrid({
  items,
  onMarkWatched,
  onRemove,
}: {
  items: WatchingItem[]
  onMarkWatched: (item: WatchingItem) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="watchlist-grid">
      {items.map((item) => (
        <div key={item.id} className="watchlist-card">
          <div className="watchlist-card-poster">
            {item.posterPath ? (
              <Image
                src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                alt=""
                width={185}
                height={278}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                placeholder="blur"
                blurDataURL={makePosterBlur(null)}
              />
            ) : (
              <div className="poster-fallback" style={{ width: '100%', height: '100%', background: 'var(--surface-sunken)' }}>
                <span className="poster-fallback-initial">{(item.title[0] ?? '?').toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="watchlist-card-info">
            <span>{item.title}</span>
          </div>
          <div className="watchlist-card-actions">
            <button type="button" onClick={() => onMarkWatched(item)}>
              <Check size={12} />
              {item.type === 'film' ? 'Watched' : 'Ep watched'}
            </button>
            <button type="button" onClick={() => onRemove(item.id)}>
              <Trash2 size={12} />
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UpNextRail({
  items,
  showDetailCache,
  caughtUpIds,
  onMarkWatched,
}: {
  items: WatchingItem[]
  showDetailCache: Record<number, TmdbShowDetail>
  caughtUpIds: Set<string>
  onMarkWatched: (item: WatchingItem, detail?: TmdbShowDetail) => void
}) {
  return (
    <div className="upnext-rail">
      {items.slice(0, 8).map((item, index) => {
        const isCaughtUp = caughtUpIds.has(item.id)
        const detail = item.tmdbId ? showDetailCache[item.tmdbId] : undefined
        const epLabel =
          item.type !== 'film' && item.type !== 'sport'
            ? formatEpisodeLabel(item.currentSeason, item.currentEpisode)
            : item.service
        return (
          <div
            key={item.id}
            className={isCaughtUp ? 'upnext-card caught-up' : 'upnext-card'}
            style={{ '--card-index': index } as CSSProperties}
          >
            {isCaughtUp ? (
              <>
                <span className="upnext-episode caught-up-label">Caught up ✓</span>
                <span className="upnext-title">{item.title}</span>
              </>
            ) : (
              <>
                <span key={epLabel} className="upnext-episode">{epLabel}</span>
                <span className="upnext-title">{item.title}</span>
                <button type="button" className="upnext-mark" onClick={() => onMarkWatched(item, detail)}>
                  <Check size={11} />
                  {item.type === 'film' ? 'Watched' : 'Ep watched'}
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={active ? 'tab active' : 'tab'} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function MediaGrid({
  dominantColourByKey,
  genreMap,
  items,
  onAction,
  onTrack,
  posterScale,
  statusByKey,
  trackedTitleSet,
}: {
  dominantColourByKey: Map<string, string>
  genreMap: Record<number, string>
  items: TmdbItem[]
  onAction: (item: TmdbItem, status: RecommendationItem['status']) => void
  onTrack: (item: TmdbItem) => void
  posterScale: number
  statusByKey: Map<string, Set<RecommendationItem['status']>>
  trackedTitleSet: Set<string>
}) {
  const gridStyle = { '--poster-scale': posterScale / 100 } as CSSProperties

  return (
    <div className="media-grid" style={gridStyle}>
      {items.map((item) => {
        const key = getTmdbItemKey(item)
        const itemStatuses = statusByKey.get(key) ?? new Set<RecommendationItem['status']>()
        const isTracked = trackedTitleSet.has(normalizeTitle(item.title ?? item.name ?? ''))
        const hasStatus = itemStatuses.size > 0 || isTracked
        const dominantColour = dominantColourByKey.get(key)
        return (
          <article
            className={hasStatus ? 'media-card selected' : 'media-card'}
            key={`${item.media_type ?? 'movie'}-${item.provider}-${item.id}`}
          >
            {item.poster_path ? (
              <Image
                src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                alt=""
                width={342}
                height={513}
                sizes="(max-width: 720px) 45vw, (max-width: 1180px) 25vw, 220px"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                placeholder="blur"
                blurDataURL={makePosterBlur(dominantColour)}
              />
            ) : (
              <div className="poster-fallback large">
                <span className="poster-fallback-initial">{((item.title ?? item.name ?? '?')[0]).toUpperCase()}</span>
                <span className="poster-fallback-title">{item.title ?? item.name}</span>
              </div>
            )}
            <div>
              <span>
                {[
                  item.media_type === 'tv' ? 'TV show' : 'Movie',
                  item.provider ?? item.release_date ?? item.first_air_date ?? 'Ireland',
                ]
                  .filter(Boolean)
                  .join(' - ')}
              </span>
              <h2>{item.title ?? item.name}</h2>
              {item.genre_ids && (
                <div className="media-genres">
                  {item.genre_ids
                    .map((id) => genreMap[id])
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((genre) => (
                      <small key={genre}>{genre}</small>
                    ))}
                </div>
              )}
              <p>{item.overview || 'No summary available.'}</p>
            </div>
            <div className="media-actions">
              <button className={isTracked ? 'selected-action' : ''} type="button" onClick={() => onTrack(item)}>
                <Plus size={16} />
                Track
              </button>
              <button
                className={itemStatuses.has('seen') ? 'selected-action' : ''}
                type="button"
                onClick={() => onAction(item, 'seen')}
              >
                <Eye size={16} />
                Seen
              </button>
              <button
                className={itemStatuses.has('favorite') ? 'selected-action' : ''}
                type="button"
                onClick={() => onAction(item, 'favorite')}
              >
                <Heart size={16} />
                Fav
              </button>
              <button
                className={itemStatuses.has('recommend') ? 'selected-action' : ''}
                type="button"
                onClick={() => onAction(item, 'recommend')}
              >
                <Send size={16} />
                Recommend
              </button>
              <button
                className={itemStatuses.has('not_interested') ? 'selected-action' : ''}
                type="button"
                onClick={() => onAction(item, 'not_interested')}
              >
                <ThumbsDown size={16} />
                Not for me
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function DiscoveryFilters({
  discoveryGenreId,
  discoveryMediaType = 'all',
  discoveryQuery,
  discoveryStatusFilter,
  genreOptions,
  onGenreChange,
  onMediaTypeChange,
  onPosterScaleChange,
  onQueryChange,
  onStatusFilterChange,
  posterScale,
  showMediaType = false,
}: {
  discoveryGenreId: number
  discoveryMediaType?: DiscoveryMediaType
  discoveryQuery: string
  discoveryStatusFilter: DiscoveryStatusFilter
  genreOptions: { id: number; name: string }[]
  onGenreChange: (id: number) => void
  onMediaTypeChange?: (type: DiscoveryMediaType) => void
  onPosterScaleChange: (scale: number) => void
  onQueryChange: (query: string) => void
  onStatusFilterChange: (status: DiscoveryStatusFilter) => void
  posterScale: number
  showMediaType?: boolean
}) {
  return (
    <div className="discovery-filters">
      <label className="field search">
        <Search size={17} />
        <input value={discoveryQuery} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search titles" />
      </label>
      <label className="field compact">
        <Filter size={17} />
        <select value={discoveryGenreId} onChange={(event) => onGenreChange(Number(event.target.value))}>
          <option value={0}>All categories</option>
          {genreOptions.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
      </label>
      {showMediaType && (
        <div className="segmented-actions media-type-toggle" aria-label="Media type">
          {[
            ['all', 'Both'],
            ['movie', 'Movies'],
            ['tv', 'TV Shows'],
          ].map(([value, label]) => (
            <button
              className={discoveryMediaType === value ? 'active' : ''}
              key={value}
              type="button"
              onClick={() => onMediaTypeChange?.(value as DiscoveryMediaType)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <label className="range-field">
        <span>Image size</span>
        <input
          type="range"
          min="80"
          max="140"
          step="10"
          value={posterScale}
          onInput={(event) => onPosterScaleChange(Number(event.currentTarget.value))}
          onChange={(event) => onPosterScaleChange(Number(event.target.value))}
        />
        <strong>{posterScale}%</strong>
      </label>
      <div className="segmented-actions status-filter-toggle" aria-label="Recommendation status">
        {[
          ['all', 'All'],
          ['unselected', 'Unmarked'],
          ['seen', 'Seen'],
          ['favorite', 'Fav'],
          ['recommend', 'Recommend'],
          ['not_interested', 'Not for me'],
        ].map(([value, label]) => (
          <button
            className={discoveryStatusFilter === value ? 'active' : ''}
            key={value}
            type="button"
            onClick={() => onStatusFilterChange(value as DiscoveryStatusFilter)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatusBucket({
  icon,
  items,
  label,
  onRemove,
}: {
  icon: ReactNode
  items: RecommendationItem[]
  label: string
  onRemove: (id: string) => void
}) {
  return (
    <article className="status-bucket">
      <div className="list-heading">
        <div>
          <p className="eyebrow">{label}</p>
          <h2>
            {icon}
            {items.length}
          </h2>
        </div>
      </div>
      <div className="mini-list">
        {items.slice(0, 6).map((item) => (
          <div className="mini-item" key={item.id}>
            <span>{item.title}</span>
            <button type="button" onClick={() => onRemove(item.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!items.length && <p className="muted-copy">Nothing here yet.</p>}
      </div>
    </article>
  )
}

function RecommendationListItem({
  item,
  lists,
  onMove,
  onRemove,
}: {
  item: RecommendationItem
  lists: RecommendationList[]
  onMove: (itemId: string, listId: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="mini-item recommendation-move-item">
      <span>{item.title}</span>
      <select
        aria-label={`Move ${item.title}`}
        value={item.listId ?? ''}
        onChange={(event) => onMove(item.id, event.target.value)}
      >
        <option value="">Inbox</option>
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onRemove(item.id)}>
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function ShowDetailPanel({
  item,
  showDetail,
  onUpdateEpisode,
  onUpdateLeavingDate,
  onToggleFavourite,
}: {
  item: WatchingItem
  showDetail: TmdbShowDetail | undefined
  onUpdateEpisode: (item: WatchingItem, season: number, episode: number) => void
  onUpdateLeavingDate: (item: WatchingItem, date: string | null) => void
  onToggleFavourite: () => void
}) {
  const [pendingCatchup, setPendingCatchup] = useState<{ season: number; episode: number } | null>(null)
  const [editingLeaving, setEditingLeaving] = useState(false)

  const daysUntilLeaving = item.leavingDate
    ? Math.ceil((new Date(item.leavingDate).getTime() - Date.now()) / 86400000)
    : null

  if (!showDetail) {
    return (
      <div className="show-detail-panel">
        <div className="show-detail-meta">
          <button
            type="button"
            className={Boolean(item.favouritedAt) ? 'toggle-chip active' : 'toggle-chip'}
            aria-pressed={Boolean(item.favouritedAt)}
            onClick={onToggleFavourite}
          >
            <Heart size={12} fill={Boolean(item.favouritedAt) ? 'currentColor' : 'none'} />
            {Boolean(item.favouritedAt) ? 'Favourited' : 'Favourite'}
          </button>
          <div className="show-detail-leaving">
            <LeavingDateRow
              item={item}
              daysUntilLeaving={daysUntilLeaving}
              editing={editingLeaving}
              onEdit={() => setEditingLeaving(true)}
              onSave={(date) => { onUpdateLeavingDate(item, date); setEditingLeaving(false) }}
              onCancel={() => setEditingLeaving(false)}
            />
          </div>
        </div>
        <p className="muted-copy">
          {item.tmdbId ? 'Loading episode data…' : 'Track from the Runway view to enable the episode grid.'}
        </p>
      </div>
    )
  }

  const currentSeason = item.currentSeason ?? 1
  const currentEpisode = item.currentEpisode ?? 0
  const avgRuntime = showDetail.episodeRunTime.length ? showDetail.episodeRunTime[0] : 40
  const watched = computeWatchProgress(item, showDetail)
  const watchedCount = Math.round((watched / 100) * showDetail.numberOfEpisodes)
  const remainingEps = Math.max(0, showDetail.numberOfEpisodes - watchedCount)
  const remainingMins = remainingEps * avgRuntime
  const remainingLabel = remainingMins >= 60
    ? `~${Math.round(remainingMins / 60)}h left`
    : remainingMins > 0 ? `~${remainingMins} min left` : 'All watched'

  function handleEpClick(season: number, ep: number, isWatched: boolean, isCurrent: boolean) {
    if (isWatched) {
      if (isCurrent) {
        onUpdateEpisode(item, season, ep - 1)
        setPendingCatchup(null)
      }
      return
    }
    const nextSeason = currentSeason
    const nextEp = currentEpisode + 1
    const isNextEp = season === nextSeason && ep === nextEp ||
      (season === currentSeason + 1 && ep === 1 && currentEpisode >= (showDetail!.seasons.find(s => s.seasonNumber === currentSeason)?.episodeCount ?? 0))
    if (isNextEp) {
      onUpdateEpisode(item, season, ep)
      setPendingCatchup(null)
    } else {
      setPendingCatchup(pendingCatchup?.season === season && pendingCatchup.episode === ep ? null : { season, episode: ep })
    }
  }

  return (
    <div className="show-detail-panel">
      {showDetail.backdropPath && (
        <div className="show-detail-backdrop">
          <Image
            src={`https://image.tmdb.org/t/p/w780${showDetail.backdropPath}`}
            alt=""
            width={780}
            height={439}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            placeholder="blur"
            blurDataURL={makePosterBlur(null)}
          />
          <div className="show-detail-backdrop-overlay" />
          <div className="show-detail-backdrop-title">
            {item.posterPath && (
              <Image
                src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                alt=""
                width={92}
                height={138}
                style={{ width: 46, height: 69, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                placeholder="blur"
                blurDataURL={makePosterBlur(null)}
              />
            )}
            <h3 style={{ viewTransitionName: 'detail-title' } as CSSProperties}>{item.title}</h3>
          </div>
        </div>
      )}
      <div className="show-detail-meta">
        <span className="episode-label">
          {watchedCount}/{showDetail.numberOfEpisodes} episodes · {remainingLabel}
        </span>
        <div className="show-detail-meta-actions">
          <button
            type="button"
            className={Boolean(item.favouritedAt) ? 'toggle-chip active' : 'toggle-chip'}
            aria-pressed={Boolean(item.favouritedAt)}
            onClick={onToggleFavourite}
          >
            <Heart size={12} fill={Boolean(item.favouritedAt) ? 'currentColor' : 'none'} />
            {Boolean(item.favouritedAt) ? 'Favourited' : 'Favourite'}
          </button>
          <LeavingDateRow
            item={item}
            daysUntilLeaving={daysUntilLeaving}
            editing={editingLeaving}
            onEdit={() => setEditingLeaving(true)}
            onSave={(date) => { onUpdateLeavingDate(item, date); setEditingLeaving(false) }}
            onCancel={() => setEditingLeaving(false)}
          />
        </div>
      </div>
      <div className="episode-grid">
        {showDetail.seasons.map((s) => (
          <div className="season-row" key={s.seasonNumber}>
            <div className="season-row-head">
              <span className="season-label">S{String(s.seasonNumber).padStart(2, '0')}</span>
              <button
                type="button"
                className="season-mark-btn"
                aria-label={`Mark season ${s.seasonNumber} watched`}
                onClick={() => { onUpdateEpisode(item, s.seasonNumber, s.episodeCount); setPendingCatchup(null) }}
              >
                <Check size={11} />
              </button>
            </div>
            <div className="episode-cells">
              {Array.from({ length: s.episodeCount }, (_, i) => {
                const epNum = i + 1
                const isWatched =
                  s.seasonNumber < currentSeason ||
                  (s.seasonNumber === currentSeason && epNum <= currentEpisode)
                const isCurrent = s.seasonNumber === currentSeason && epNum === currentEpisode
                const isPending = pendingCatchup?.season === s.seasonNumber && pendingCatchup.episode === epNum
                return (
                  <button
                    key={epNum}
                    type="button"
                    className={[
                      'ep-cell',
                      isWatched ? 'watched' : '',
                      isPending ? 'pending' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={`S${s.seasonNumber} E${epNum}${isWatched ? ' (watched)' : ''}`}
                    title={`E${epNum}`}
                    onClick={() => handleEpClick(s.seasonNumber, epNum, isWatched, isCurrent)}
                  />
                )
              })}
            </div>
            {pendingCatchup?.season === s.seasonNumber && (
              <div className="ep-catchup-bar">
                <span className="ep-catchup-label">S{String(s.seasonNumber).padStart(2, '0')} E{String(pendingCatchup.episode).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="ep-catchup-btn"
                  onClick={() => { onUpdateEpisode(item, pendingCatchup.season, pendingCatchup.episode); setPendingCatchup(null) }}
                >
                  <Check size={12} />
                  Watched up to here
                </button>
                <button
                  type="button"
                  className="ep-catchup-btn secondary"
                  onClick={() => { onUpdateEpisode(item, pendingCatchup.season, pendingCatchup.episode); setPendingCatchup(null) }}
                >
                  Just this episode
                </button>
                <button
                  type="button"
                  className="ep-catchup-dismiss"
                  onClick={() => setPendingCatchup(null)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function LeavingDateRow({
  item,
  daysUntilLeaving,
  editing,
  onEdit,
  onSave,
  onCancel,
}: {
  item: WatchingItem
  daysUntilLeaving: number | null
  editing: boolean
  onEdit: () => void
  onSave: (date: string | null) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(item.leavingDate ?? '')
  const isUrgent = daysUntilLeaving !== null && daysUntilLeaving <= 7
  if (editing) {
    return (
      <div className="leaving-edit">
        <input
          type="date"
          className="leaving-date-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button type="button" className="ep-catchup-btn" onClick={() => onSave(value || null)}>
          <Check size={12} /> Save
        </button>
        {item.leavingDate && (
          <button type="button" className="ep-catchup-btn secondary" onClick={() => onSave(null)}>
            Clear
          </button>
        )}
        <button type="button" className="ep-catchup-dismiss" onClick={onCancel}>×</button>
      </div>
    )
  }
  return (
    <button type="button" className={isUrgent ? 'leaving-chip urgent' : 'leaving-chip'} onClick={onEdit}>
      {daysUntilLeaving !== null
        ? isUrgent
          ? `Leaving in ${daysUntilLeaving} day${daysUntilLeaving === 1 ? '' : 's'}`
          : `Leaving ${formatShortDate(item.leavingDate!)}`
        : 'Leaving soon?'}
    </button>
  )
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <MonitorPlay size={28} />
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
    </div>
  )
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map((item) => (
        <div className="skeleton" key={item} />
      ))}
    </>
  )
}

function useStoredState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(key)
    if (stored) setValue(JSON.parse(stored) as T)
    setHydrated(true)
  }, [key])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(key, JSON.stringify(value))
  }, [hydrated, key, value])

  return [value, setValue] as const
}

function mediaToWatchingItem(item: TmdbItem): WatchingItem {
  return {
    id: crypto.randomUUID(),
    title: item.title ?? item.name ?? 'Untitled',
    service: item.provider ?? 'Streaming',
    nextEpisode: item.release_date ?? item.first_air_date ?? new Date().toISOString().slice(0, 10),
    cadence: 'Unknown',
    notes: item.overview.slice(0, 120),
    type: item.media_type === 'movie' ? 'film' : 'show',
    done: false,
    tmdbId: item.id,
    posterPath: item.poster_path ?? null,
  }
}

function providersChanged(left: Provider[], right: Provider[]) {
  return left.some((provider, index) => {
    const next = right[index]
    return !next || provider.id !== next.id || provider.enabled !== next.enabled
  })
}

function getTmdbItemKey(item: TmdbItem) {
  return `${item.media_type ?? (item.name ? 'tv' : 'movie')}-${item.id}`
}

function getRecommendationItemKey(item: RecommendationItem) {
  if (!item.tmdbId) return ''
  return `${item.mediaType || 'movie'}-${item.tmdbId}`
}

function getWatchStatus(item: WatchingItem): WatchStatus {
  if (item.status) return item.status
  return item.done ? 'completed' : 'watching'
}

function watchStatusLabel(status: WatchStatus) {
  if (status === 'planned') return 'Plan to watch'
  if (status === 'waiting') return 'Waiting'
  if (status === 'completed') return 'Completed'
  if (status === 'dropped') return 'Dropped'
  return 'Watching'
}

function watchTypeLabel(type: WatchingItem['type']) {
  if (type === 'film') return 'Film'
  if (type === 'sport') return 'Sport'
  if (type === 'other') return 'Other'
  return 'TV show'
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase()
}

function isVisibleDiscoveryItem(item: TmdbItem, hiddenGenres: Set<number>) {
  if (item.genre_ids?.some((id) => hiddenGenres.has(id))) return false
  return true
}

function filterDiscoveryItems(
  items: TmdbItem[],
  query: string,
  genreId: number,
  mediaType: DiscoveryMediaType,
  statusFilter: DiscoveryStatusFilter,
  statusByKey: Map<string, Set<RecommendationItem['status']>>,
) {
  const term = query.trim().toLowerCase()
  return items.filter((item) => {
    const title = item.title ?? item.name ?? ''
    const provider = item.provider ?? ''
    const statuses = statusByKey.get(getTmdbItemKey(item)) ?? new Set<RecommendationItem['status']>()
    const matchesTerm = !term || `${title} ${provider} ${item.overview}`.toLowerCase().includes(term)
    const matchesGenre = !genreId || item.genre_ids?.includes(genreId)
    const matchesMediaType = mediaType === 'all' || (item.media_type ?? (item.name ? 'tv' : 'movie')) === mediaType
    const matchesStatus =
      statusFilter === 'all'
        ? !statuses.has('not_interested')
        : statusFilter === 'unselected'
          ? statuses.size === 0
          : statuses.has(statusFilter)

    return matchesTerm && matchesGenre && matchesMediaType && matchesStatus
  })
}

function getProgrammeChannelId(item: TvMazeEpisode) {
  return String(item.show.id)
}

function getDaysUntil(dateStr: string): number {
  const todayStr = formatIrelandDate(new Date())
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [ry, rm, rd] = dateStr.split('-').map(Number)
  return Math.round((Date.UTC(ry, rm - 1, rd) - Date.UTC(ty, tm - 1, td)) / 86400000)
}

function getProgrammeStatus(item: TvMazeEpisode, nowMs: number): 'on-now' | 'next' | 'later' {
  const start = Date.parse(item.airstamp)
  const end = start + (item.runtime ?? 60) * 60 * 1000
  if (nowMs >= start && nowMs < end) return 'on-now'
  if (start > nowMs && start - nowMs <= 30 * 60 * 1000) return 'next'
  return 'later'
}

function isSportProgramme(item: TvMazeEpisode) {
  const genres = item.show.genres ?? []
  if (genres.some((genre) => genre.toLowerCase() === 'sports' || genre.toLowerCase() === 'sport')) return true

  const text = `${item.show.name} ${item.name} ${item.show.network?.name ?? ''} ${item.show.webChannel?.name ?? ''}`.toLowerCase()
  return [
    'sport',
    'football',
    'rugby',
    'gaa',
    'hurling',
    'golf',
    'tennis',
    'formula 1',
    'f1',
    'boxing',
    'racing',
    'cricket',
    'motorsport',
    'ufc',
  ].some((term) => text.includes(term))
}

function statusLabel(status: RecommendationItem['status'], title: string) {
  if (status === 'seen') return `${title} marked seen`
  if (status === 'favorite') return `${title} added to favorites`
  if (status === 'recommend') return `${title} added to recommendation inbox`
  return `${title} hidden from discovery`
}

function formatTime(value: string) {
  if (!value) return 'TBC'
  return new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatIrelandDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Dublin',
    year: 'numeric',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function formatShortDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('en-IE', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Europe/Dublin',
    }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  }

  return new Intl.DateTimeFormat('en-IE', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Dublin',
  }).format(new Date(value))
}

function makePosterBlur(colour: string | null | undefined): string {
  const bg = colour ?? '#EEF0F3'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15"><rect width="10" height="15" fill="${bg}"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function computeWatchProgress(item: WatchingItem, detail: TmdbShowDetail): number {
  if (!detail.numberOfEpisodes) return 0
  let watched = 0
  const currentSeason = item.currentSeason ?? 1
  const currentEpisode = item.currentEpisode ?? 0
  for (const s of detail.seasons) {
    if (s.seasonNumber < currentSeason) {
      watched += s.episodeCount
    } else if (s.seasonNumber === currentSeason) {
      watched += Math.min(currentEpisode, s.episodeCount)
    }
  }
  return Math.min(100, Math.round((100 * watched) / detail.numberOfEpisodes))
}

function formatGreeting(date: Date): string {
  return new Intl.DateTimeFormat('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Dublin',
  }).format(date)
}

// ─── Completion Prompt (Phase 4) ──────────────────────────────────────────────

function CompletionPromptCard({
  item,
  lists,
  onFavourite,
  onRecommend,
  onDismiss,
}: {
  item: WatchingItem
  lists: RecommendationList[]
  onFavourite: () => void
  onRecommend: (listId: string | null, note: string) => void
  onDismiss: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [note, setNote] = useState('')
  const [selectedList, setSelectedList] = useState<string>('')
  const isFav = Boolean(item.favouritedAt)

  function submitRecommend() {
    onRecommend(selectedList || null, note.trim())
    setShowPicker(false)
  }

  return (
    <div className="completion-card" role="complementary" aria-label="Completion actions">
      <div className="completion-card-head">
        <span className="completion-card-msg">
          You finished <strong>{item.title}</strong>
        </span>
        <button type="button" className="ep-catchup-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
      <div className="completion-card-actions">
        <button
          type="button"
          className={isFav ? 'completion-action completion-action-on' : 'completion-action'}
          onClick={onFavourite}
        >
          <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
          {isFav ? 'Favourited' : 'Favourite'}
        </button>
        {showPicker ? (
          <div className="completion-list-picker">
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
            >
              <option value="">Inbox (no list)</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input
              className="completion-note-input"
              placeholder="Optional note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRecommend() }}
              maxLength={160}
            />
            <button type="button" className="completion-action" onClick={submitRecommend}>
              <Send size={12} />
              Send
            </button>
            <button type="button" className="ep-catchup-dismiss" onClick={() => setShowPicker(false)}>×</button>
          </div>
        ) : (
          <button type="button" className="completion-action" onClick={() => setShowPicker(true)}>
            <Send size={14} />
            Recommend
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Search Overlay (Phase 3) ─────────────────────────────────────────────────

function SearchOverlay({
  watching,
  recentSearches,
  trackedTitleSet,
  onClose,
  onWatchlist,
  onTrack,
  onSeen,
  onAddRecent,
  onOpenLibraryItem,
}: {
  watching: WatchingItem[]
  recentSearches: string[]
  trackedTitleSet: Set<string>
  onClose: () => void
  onWatchlist: (item: TmdbItem) => void
  onTrack: (item: TmdbItem) => void
  onSeen: (item: TmdbItem) => void
  onAddRecent: (q: string) => void
  onOpenLibraryItem: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [tmdbResults, setTmdbResults] = useState<TmdbItem[]>([])
  const [tmdbLoading, setTmdbLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const libraryResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.length < 2) return []
    return watching.filter((item) => item.title.toLowerCase().includes(q)).slice(0, 5)
  }, [watching, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) { setTmdbResults([]); return }
    setTmdbLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/media-guide/search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = (await res.json()) as { results: TmdbItem[] }
          setTmdbResults(data.results ?? [])
        }
      } catch { /* best-effort */ }
      setTmdbLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const totalResults = libraryResults.length + tmdbResults.length

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, totalResults - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') {
      const libItem = libraryResults[highlightIdx]
      if (libItem) { onOpenLibraryItem(libItem.id); return }
      const tmdbIdx = highlightIdx - libraryResults.length
      const tmdbItem = tmdbResults[tmdbIdx]
      if (tmdbItem) { onAddRecent(query.trim()); onTrack(tmdbItem) }
      return
    }
    const tmdbIdx = highlightIdx - libraryResults.length
    const tmdbItem = tmdbResults[tmdbIdx]
    if (!tmdbItem) return
    if (e.key === 'w' || e.key === 'W') { onAddRecent(query.trim()); onWatchlist(tmdbItem) }
    if (e.key === 't' || e.key === 'T') { onAddRecent(query.trim()); onTrack(tmdbItem) }
    if (e.key === 's' || e.key === 'S') { onAddRecent(query.trim()); onSeen(tmdbItem) }
  }

  const showEmpty = !query.trim()

  return (
    <div className="search-overlay" role="dialog" aria-label="Search" onClick={onClose}>
      <div className="search-overlay-panel" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Input row */}
        <div className="search-overlay-input-row">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            className="search-overlay-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightIdx(0) }}
            placeholder="Search shows & films…"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) onAddRecent(query.trim())
            }}
          />
          <button type="button" className="search-esc-btn" onClick={onClose}><kbd>Esc</kbd></button>
        </div>

        <div className="search-results">
          {/* Empty state — recent searches */}
          {showEmpty && recentSearches.length > 0 && (
            <div className="search-group">
              <p className="search-section-label">Recent</p>
              {recentSearches.map((s) => (
                <button key={s} type="button" className="search-recent-chip" onClick={() => setQuery(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {showEmpty && (
            <button type="button" className="search-browse-link" onClick={onClose}>
              Browse your library →
            </button>
          )}

          {/* Library results */}
          {libraryResults.length > 0 && (
            <div className="search-group">
              <p className="search-section-label">In your library</p>
              {libraryResults.map((item, i) => {
                const isHighlighted = highlightIdx === i
                const rel = item.relationship ?? statusToRelationship(item.status, item.done)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`search-result-row ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => onOpenLibraryItem(item.id)}
                    onMouseEnter={() => setHighlightIdx(i)}
                  >
                    {item.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                        alt=""
                        width={32}
                        height={48}
                        style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                      />
                    ) : (
                      <div className="search-result-poster-placeholder" />
                    )}
                    <div className="search-result-info">
                      <strong>{item.title}</strong>
                      <span className="search-result-meta">
                        <span className={`rel-badge rel-badge-${rel}`}>{relationshipLabel(rel)}</span>
                        {item.service && <span>{item.service}</span>}
                        {item.currentSeason && item.currentEpisode !== undefined && (
                          <span>S{item.currentSeason}·E{item.currentEpisode}</span>
                        )}
                      </span>
                    </div>
                    <ChevronRight size={16} className="search-result-arrow" />
                  </button>
                )
              })}
            </div>
          )}

          {/* TMDb results */}
          {(!showEmpty && (tmdbResults.length > 0 || tmdbLoading)) && (
            <div className="search-group">
              <p className="search-section-label">Add something new</p>
              {tmdbLoading && <div className="search-skeleton-row" />}
              {tmdbResults.map((item, i) => {
                const idx = libraryResults.length + i
                const isHighlighted = highlightIdx === idx
                const isTracked = trackedTitleSet.has(normalizeTitle(item.title ?? item.name ?? ''))
                const year = item.release_date?.slice(0, 4) ?? item.first_air_date?.slice(0, 4)
                const typeLabel = item.media_type === 'tv' ? 'TV series' : 'Film'
                return (
                  <div
                    key={item.id}
                    className={`search-result-row ${isHighlighted ? 'highlighted' : ''}`}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    {item.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                        alt=""
                        width={32}
                        height={48}
                        style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                      />
                    ) : (
                      <div className="search-result-poster-placeholder" />
                    )}
                    <div className="search-result-info">
                      <strong>{item.title ?? item.name}</strong>
                      <span className="search-result-meta">
                        {year && <span>{year}</span>}
                        <span>{typeLabel}</span>
                        {isTracked && <span className="rel-badge rel-badge-tracking">In library</span>}
                      </span>
                    </div>
                    <div className="search-result-actions">
                      <button
                        type="button"
                        className="search-action-btn"
                        title="Add to watchlist (W)"
                        onClick={() => { onAddRecent(query.trim()); onWatchlist(item) }}
                      >
                        + Watchlist
                      </button>
                      <button
                        type="button"
                        className="search-action-btn"
                        title="Track (T)"
                        onClick={() => { onAddRecent(query.trim()); onTrack(item) }}
                      >
                        ▶ Track
                      </button>
                      <button
                        type="button"
                        className="search-action-btn search-action-seen"
                        title="Seen it (S)"
                        onClick={() => { onAddRecent(query.trim()); onSeen(item) }}
                      >
                        ✓ Seen it
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
