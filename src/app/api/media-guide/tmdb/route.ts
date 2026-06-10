import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

type Provider = {
  id: number
  label: string
  match: string[]
  enabled: boolean
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

const defaultProviders: Provider[] = [
  { id: 0, label: 'Sky / NOW', match: ['Sky Go', 'NOW', 'Now TV'], enabled: true },
  { id: 0, label: 'Netflix', match: ['Netflix'], enabled: true },
  { id: 0, label: 'Prime Video', match: ['Amazon Prime Video', 'Prime Video'], enabled: true },
  { id: 0, label: 'Apple TV+', match: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], enabled: true },
  { id: 0, label: 'Paramount+', match: ['Paramount Plus', 'Paramount+'], enabled: true },
]

const discoverPagesPerProvider = 3
const streamingResultLimit = 240

export async function POST(request: Request) {
  try {
    if (!(await hasMediaGuideSession())) {
      return NextResponse.json(
        { error: 'Runway login required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const apiKey = process.env.TMDB_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB_API_KEY is not configured in this Vercel environment.' }, { status: 500 })
    }

    const { providers } = (await request.json()) as { providers?: Provider[] }
    const providerMap = await fetchTmdbProviders(apiKey, providers?.length ? providers : defaultProviders)
    const enabledProviders = providerMap.filter((item) => item.enabled && item.id)
    const [movieRows, tvRows, cinemaRows, movieGenres, tvGenres] = await Promise.all([
      enabledProviders.length ? fetchTmdbDiscover(apiKey, 'movie', enabledProviders) : Promise.resolve([]),
      enabledProviders.length ? fetchTmdbDiscover(apiKey, 'tv', enabledProviders) : Promise.resolve([]),
      fetchTmdbCinema(apiKey),
      fetchTmdbGenres(apiKey, 'movie'),
      fetchTmdbGenres(apiKey, 'tv'),
    ])

    return NextResponse.json(
      {
        refreshedAt: new Date().toISOString(),
        genreMap: { ...movieGenres, ...tvGenres },
        providers: providerMap,
        streaming: [...movieRows, ...tvRows].sort((a, b) => b.vote_average - a.vote_average).slice(0, streamingResultLimit),
        cinema: cinemaRows,
      },
      { headers: { 'Cache-Control': 'private, max-age=900' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load TMDb data.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

async function fetchTmdbProviders(apiKey: string, currentProviders: Provider[]) {
  const response = await fetch(`https://api.themoviedb.org/3/watch/providers/movie?api_key=${apiKey}&watch_region=IE`)
  await assertTmdbResponse(response, 'providers')
  const data = (await response.json()) as { results: { provider_id: number; provider_name: string }[] }

  return currentProviders.map((provider) => {
    const match = data.results.find((row) =>
      provider.match.some((candidate) => row.provider_name.toLowerCase().includes(candidate.toLowerCase())),
    )
    return { ...provider, id: match?.provider_id ?? provider.id }
  })
}

async function fetchTmdbDiscover(
  apiKey: string,
  type: 'movie' | 'tv',
  providers: Provider[],
): Promise<TmdbItem[]> {
  const rows = await Promise.all(
    providers.map(async (provider) => {
      const pages = await Promise.all(
        Array.from({ length: discoverPagesPerProvider }, async (_, index) => {
          const page = index + 1
          const response = await fetch(
            `https://api.themoviedb.org/3/discover/${type}?api_key=${apiKey}&watch_region=IE&with_watch_providers=${provider.id}&sort_by=popularity.desc&page=${page}`,
          )
          await assertTmdbResponse(response, `${provider.label} ${type} titles`)
          const data = (await response.json()) as { results: TmdbItem[] }
          return data.results
        }),
      )

      return pages.flat().map((item) => ({
        ...item,
        media_type: type,
        provider: provider.label,
      }))
    }),
  )

  return dedupeByProvider(rows.flat())
}

async function fetchTmdbCinema(apiKey: string): Promise<TmdbItem[]> {
  const today = new Date()
  const future = new Date()
  future.setDate(today.getDate() + 60)
  const response = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&region=IE&primary_release_date.gte=${today
      .toISOString()
      .slice(0, 10)}&primary_release_date.lte=${future.toISOString().slice(0, 10)}&sort_by=primary_release_date.asc`,
  )
  await assertTmdbResponse(response, 'cinema releases')
  const data = (await response.json()) as { results: TmdbItem[] }
  return data.results.slice(0, 18).map((item) => ({ ...item, media_type: 'movie', provider: item.release_date }))
}

async function fetchTmdbGenres(apiKey: string, type: 'movie' | 'tv') {
  const response = await fetch(`https://api.themoviedb.org/3/genre/${type}/list?api_key=${apiKey}&language=en`)
  if (!response.ok) return {}
  const data = (await response.json()) as { genres: { id: number; name: string }[] }
  return Object.fromEntries(data.genres.map((genre) => [genre.id, genre.name]))
}

async function assertTmdbResponse(response: Response, label: string) {
  if (response.ok) return

  let detail = ''
  try {
    const data = (await response.json()) as { status_message?: string }
    detail = data.status_message ? ` ${data.status_message}` : ''
  } catch {
    detail = ''
  }

  throw new Error(`TMDb ${label} request failed (${response.status}).${detail}`)
}

function dedupeByProvider(items: TmdbItem[]) {
  const seen = new Map<string, TmdbItem>()
  items.forEach((item) => {
    const key = `${item.media_type ?? 'movie'}-${item.id}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, item)
      return
    }

    const providers = new Set([...(existing.provider?.split(' + ') ?? []), item.provider].filter(Boolean))
    seen.set(key, { ...existing, provider: Array.from(providers).join(' + ') })
  })

  return Array.from(seen.values()).sort((a, b) => b.vote_average - a.vote_average)
}
