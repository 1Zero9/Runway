import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'
import { getMediaGuideSql } from '@/lib/media-guide-db'
import { ensureRunwayTables, RUNWAY_USER_ID } from '@/lib/runway-db'
import type { RunwayShowRow, RunwayEpisodeRow } from '@/lib/runway-db'
import { extractDominantColour } from '@/lib/dominant-colour'

type TmdbShowResponse = {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
  status: string
  next_episode_to_air: { air_date: string } | null
  seasons: { season_number: number; episode_count: number }[]
}

type TmdbSeasonResponse = {
  episodes: {
    id: number
    episode_number: number
    name: string
    air_date: string | null
    runtime: number | null
  }[]
}

function normaliseTmdbStatus(s: string): string {
  const map: Record<string, string> = {
    'Returning Series': 'returning',
    'Ended': 'ended',
    'Canceled': 'cancelled',
    'In Production': 'in_production',
    'Planned': 'planned',
    'Pilot': 'pilot',
  }
  return map[s] ?? s.toLowerCase().replace(/\s+/g, '_')
}

async function syncEpisodes(
  sql: ReturnType<typeof getMediaGuideSql>,
  showId: string,
  tmdbId: number,
  seasons: { season_number: number }[],
  apiKey: string,
) {
  const regularSeasons = seasons.filter((s) => s.season_number > 0)

  await Promise.all(
    regularSeasons.map(async (season) => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season.season_number}?api_key=${apiKey}&language=en-IE`,
          { next: { revalidate: 3600 } },
        )
        if (!res.ok) return

        const data = (await res.json()) as TmdbSeasonResponse
        for (const ep of data.episodes ?? []) {
          if (ep.episode_number < 1) continue
          const epId = crypto.randomUUID()
          await sql`
            insert into runway_episodes (id, show_id, season, episode, title, air_date, runtime)
            values (
              ${epId},
              ${showId},
              ${season.season_number},
              ${ep.episode_number},
              ${ep.name ?? null},
              ${ep.air_date ?? null},
              ${ep.runtime ?? null}
            )
            on conflict (show_id, season, episode) do update set
              title = excluded.title,
              air_date = excluded.air_date,
              runtime = excluded.runtime,
              synced_at = now()
          `
        }
      } catch {
        // don't block the track operation on a single failed season
      }
    }),
  )
}

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  const rows = await sql`
    select id, user_id, tmdb_id, title, poster_path, backdrop_path, dominant_colour, status, next_air_date, created_at
    from runway_shows
    where user_id = ${RUNWAY_USER_ID}
    order by created_at desc
  `

  return NextResponse.json({ shows: rows as RunwayShowRow[] })
}

export async function POST(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 })
  }

  const body = (await request.json()) as { tmdbId?: number }
  if (!body.tmdbId) {
    return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 })
  }

  const tmdbRes = await fetch(
    `https://api.themoviedb.org/3/tv/${body.tmdbId}?api_key=${apiKey}&language=en-IE`,
    { next: { revalidate: 3600 } },
  )
  if (!tmdbRes.ok) {
    return NextResponse.json({ error: 'TMDb show not found' }, { status: 404 })
  }

  const tmdb = (await tmdbRes.json()) as TmdbShowResponse

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  const showId = crypto.randomUUID()
  const rows = await sql`
    insert into runway_shows (id, user_id, tmdb_id, title, poster_path, backdrop_path, status, next_air_date)
    values (
      ${showId},
      ${RUNWAY_USER_ID},
      ${tmdb.id},
      ${tmdb.name},
      ${tmdb.poster_path ?? null},
      ${tmdb.backdrop_path ?? null},
      ${normaliseTmdbStatus(tmdb.status)},
      ${tmdb.next_episode_to_air?.air_date ?? null}
    )
    on conflict (user_id, tmdb_id) do update set
      title = excluded.title,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      status = excluded.status,
      next_air_date = excluded.next_air_date
    returning id, user_id, tmdb_id, title, poster_path, backdrop_path, dominant_colour, status, next_air_date, created_at
  `

  const show = rows[0] as RunwayShowRow

  // Sync episodes and extract dominant colour in the background (non-blocking)
  syncEpisodes(sql, show.id, tmdb.id, tmdb.seasons ?? [], apiKey).catch(() => {})
  if (tmdb.poster_path) {
    extractDominantColour(tmdb.poster_path).then(async (colour) => {
      if (colour) {
        await sql`update runway_shows set dominant_colour = ${colour} where id = ${show.id}`
      }
    }).catch(() => {})
  }

  return NextResponse.json({ show }, { status: 201 })
}

export async function DELETE(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  await sql`
    delete from runway_shows
    where id = ${id} and user_id = ${RUNWAY_USER_ID}
  `

  return new NextResponse(null, { status: 204 })
}

export type { RunwayEpisodeRow }
