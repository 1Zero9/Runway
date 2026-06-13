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
  const trending = data.results.slice(0, 14).map((item) => ({
    id: item.id,
    title: item.title ?? item.name ?? '',
    media_type: item.media_type,
    poster_path: item.poster_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  }))

  return NextResponse.json(
    { trending },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}
