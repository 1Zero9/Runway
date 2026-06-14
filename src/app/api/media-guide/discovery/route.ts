import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

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
}

type TmdbProvider = {
  provider_name: string
}

type WatchProviderResponse = {
  results?: {
    IE?: {
      flatrate?: TmdbProvider[]
      free?: TmdbProvider[]
      ads?: TmdbProvider[]
      rent?: TmdbProvider[]
      buy?: TmdbProvider[]
    }
  }
}

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json(
      { error: 'Runway login required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&region=IE&language=en-IE`,
    { next: { revalidate: 86400 } },
  )

  if (!res.ok) {
    return NextResponse.json(
      { error: `TMDB trending failed (${res.status})` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const data = (await res.json()) as { results: TmdbItem[] }
  const baseTrending = data.results
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .slice(0, 14)

  const trending = await Promise.all(
    baseTrending.map(async (item) => {
      const mediaType = item.media_type ?? (item.name ? 'tv' : 'movie')
      const provider = await fetchIrelandProvider(apiKey, mediaType, item.id)
      return {
        id: item.id,
        title: item.title ?? item.name ?? '',
        media_type: mediaType,
        overview: item.overview ?? '',
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        provider,
      }
    }),
  )

  return NextResponse.json(
    { trending },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}

async function fetchIrelandProvider(apiKey: string, mediaType: 'movie' | 'tv', id: number) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers?api_key=${apiKey}`,
      { next: { revalidate: 86400 } },
    )
    if (!res.ok) return ''

    const data = (await res.json()) as WatchProviderResponse
    const ie = data.results?.IE
    if (!ie) return ''

    const candidates = [...(ie.flatrate ?? []), ...(ie.free ?? []), ...(ie.ads ?? []), ...(ie.rent ?? []), ...(ie.buy ?? [])]
    const names = Array.from(new Set(candidates.map((provider) => provider.provider_name).filter(Boolean)))
    return names.slice(0, 2).join(' / ')
  } catch {
    return ''
  }
}
