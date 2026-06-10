import { NextResponse } from 'next/server'
import { getMediaGuideSql } from '@/lib/media-guide-db'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

type TmdbSuggestion = {
  id: number
  title?: string
  name?: string
  media_type: 'movie' | 'tv'
  overview: string
  poster_path: string | null
  vote_average: number
  genre_ids?: number[]
  release_date?: string
  first_air_date?: string
  provider: string
}

type TmdbResult = {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  vote_average: number
  genre_ids?: number[]
  release_date?: string
  first_air_date?: string
}

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return NextResponse.json({ suggestions: [] })

  const sql = getMediaGuideSql()

  // Use favorites from recommendation items (they already have tmdb_id)
  const favorites = await sql`
    select tmdb_id, media_type, title
    from media_recommendation_items
    where status = 'favorite' and tmdb_id is not null
    order by created_at desc
    limit 6
  `

  // Also use highly-rated watchlist items that have a tmdb_id
  const ratedItems = await sql`
    select tmdb_id, type, title
    from media_watchlist
    where tmdb_id is not null and user_rating >= 4
    order by user_rating desc, created_at desc
    limit 4
  `

  type SeedItem = { tmdb_id: number; media_type: string; title: string }

  const seeds: SeedItem[] = [
    ...(favorites as SeedItem[]),
    ...(ratedItems as { tmdb_id: number; type: string; title: string }[]).map((r) => ({
      tmdb_id: r.tmdb_id,
      media_type: r.type === 'film' ? 'movie' : 'tv',
      title: r.title,
    })),
  ]

  if (!seeds.length) {
    return NextResponse.json({ suggestions: [] })
  }

  const seen = new Set<string>()
  const suggestions: TmdbSuggestion[] = []

  await Promise.all(
    seeds.slice(0, 5).map(async (seed) => {
      try {
        const mediaType = seed.media_type === 'movie' ? 'movie' : 'tv'
        const url = `https://api.themoviedb.org/3/${mediaType}/${seed.tmdb_id}/recommendations?api_key=${apiKey}&language=en-IE&page=1`
        const res = await fetch(url, { next: { revalidate: 3600 } })
        if (!res.ok) return

        const data = (await res.json()) as { results: TmdbResult[] }
        for (const item of (data.results ?? []).slice(0, 8)) {
          const key = `${mediaType}-${item.id}`
          if (seen.has(key)) continue
          seen.add(key)
          suggestions.push({
            ...item,
            media_type: mediaType,
            provider: `Because you liked ${seed.title}`,
          })
        }
      } catch {
        // skip failed seed
      }
    }),
  )

  // Sort by vote_average desc, take top 12
  suggestions.sort((a, b) => b.vote_average - a.vote_average)

  return NextResponse.json({ suggestions: suggestions.slice(0, 12) })
}
