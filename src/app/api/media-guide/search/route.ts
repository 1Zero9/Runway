import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

type TmdbMultiResult = {
  id: number
  title?: string
  name?: string
  media_type: 'movie' | 'tv' | 'person'
  overview: string
  poster_path: string | null
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  release_date?: string
  first_air_date?: string
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = new URL('https://api.themoviedb.org/3/search/multi')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('query', q)
    url.searchParams.set('page', '1')
    url.searchParams.set('region', 'IE')
    url.searchParams.set('include_adult', 'false')

    const res = await fetch(url.toString(), { next: { revalidate: 0 } })
    if (!res.ok) return NextResponse.json({ results: [] })

    const data = (await res.json()) as { results: TmdbMultiResult[] }

    const results = data.results
      .filter((item) => item.media_type !== 'person')
      .filter((item) => item.poster_path)
      .filter((item) => item.vote_count > 5)
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        title: item.title,
        name: item.name,
        media_type: item.media_type as 'movie' | 'tv',
        overview: item.overview,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        genre_ids: item.genre_ids,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        provider: item.media_type === 'tv' ? 'TV series' : 'Film',
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
