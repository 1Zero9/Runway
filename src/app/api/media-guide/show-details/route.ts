import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

type TmdbTvResponse = {
  id: number
  name: string
  number_of_episodes: number
  episode_run_time: number[]
  backdrop_path: string | null
  seasons: { id: number; season_number: number; episode_count: number }[]
}

export async function GET(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json(
      { error: 'Runway login required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 })

  const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${apiKey}&language=en-IE`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return NextResponse.json({ error: 'TMDb show not found' }, { status: res.status })

  const data = (await res.json()) as TmdbTvResponse

  return NextResponse.json({
    id: data.id,
    name: data.name,
    numberOfEpisodes: data.number_of_episodes,
    episodeRunTime: data.episode_run_time ?? [],
    backdropPath: data.backdrop_path ?? null,
    seasons: (data.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({ seasonNumber: s.season_number, episodeCount: s.episode_count })),
  })
}
