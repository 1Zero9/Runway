import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'
import { neon } from '@neondatabase/serverless'

type WatchlistRow = { id: string; tmdb_id: number; type: string | null }

export async function POST() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured', enriched: 0, noArt: [] })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured', enriched: 0, noArt: [] })
  }

  const sql = neon(process.env.DATABASE_URL)

  const rows = await sql`
    select id, tmdb_id, type
    from media_watchlist
    where tmdb_id is not null and (poster_path is null or poster_path = '')
  ` as WatchlistRow[]

  if (!rows.length) {
    return NextResponse.json({ enriched: 0, noArt: [] })
  }

  const noArt: string[] = []
  let enriched = 0

  await Promise.all(
    rows.map(async (row) => {
      const mediaType = row.type === 'film' ? 'movie' : 'tv'
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${row.tmdb_id}?api_key=${apiKey}&language=en-IE`,
          { next: { revalidate: 3600 } },
        )
        if (!res.ok) { noArt.push(row.id); return }
        const data = (await res.json()) as { poster_path?: string | null; title?: string; name?: string }
        if (!data.poster_path) { noArt.push(row.id); return }
        await sql`
          update media_watchlist
          set poster_path = ${data.poster_path}
          where id = ${row.id}
        `
        enriched++
      } catch {
        noArt.push(row.id)
      }
    }),
  )

  return NextResponse.json({ enriched, noArt })
}
