import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

type WatchlistRow = {
  id: string
  title: string
  service: string | null
  next_episode: string | null
  cadence: string | null
  notes: string | null
  type: string | null
  user_rating: number | null
  last_watched_at: string | null
  watched_count: number | null
  done: boolean
  status: string | null
  current_season: number | null
  current_episode: number | null
  tmdb_id: number | null
  poster_path: string | null
}

type WatchlistPayload = {
  id?: string
  title?: string
  service?: string
  nextEpisode?: string
  cadence?: string
  notes?: string
  type?: string
  userRating?: number | null
  lastWatchedAt?: string | null
  currentSeason?: number | null
  currentEpisode?: number | null
  tmdbId?: number | null
  posterPath?: string | null
  watchedCount?: number
  done?: boolean
  status?: string
}

export async function GET() {
  const unauthorized = await requireMediaGuideSession()
  if (unauthorized) return unauthorized

  const sql = await getSql()
  const rows = await sql`
    select id, title, service, next_episode, cadence, notes, type, user_rating, last_watched_at, watched_count, done, status, current_season, current_episode, tmdb_id, poster_path
    from media_watchlist
    order by done asc, next_episode asc nulls last, created_at desc
  `

  return NextResponse.json((rows as WatchlistRow[]).map(mapRow))
}

export async function POST(request: Request) {
  const unauthorized = await requireMediaGuideSession()
  if (unauthorized) return unauthorized

  const payload = (await request.json()) as WatchlistPayload
  if (!payload.title?.trim()) {
    return NextResponse.json({ error: 'title is required.' }, { status: 400 })
  }

  const sql = await getSql()
  const userRating = normalizeRating(payload.userRating)
  const rows = await sql`
    insert into media_watchlist (
      id, title, service, next_episode, cadence, notes, type, user_rating, last_watched_at, watched_count, done, status, current_season, current_episode, tmdb_id, poster_path
    )
    values (
      ${payload.id ?? crypto.randomUUID()},
      ${payload.title.trim()},
      ${payload.service ?? ''},
      ${payload.nextEpisode || null},
      ${payload.cadence ?? 'Weekly'},
      ${payload.notes ?? ''},
      ${payload.type ?? 'show'},
      ${userRating},
      ${payload.lastWatchedAt || null},
      ${payload.watchedCount ?? 0},
      ${payload.done ?? false},
      ${payload.status ?? (payload.done ? 'completed' : 'watching')},
      ${payload.currentSeason ?? 1},
      ${payload.currentEpisode ?? 0},
      ${payload.tmdbId ?? null},
      ${payload.posterPath ?? null}
    )
    returning id, title, service, next_episode, cadence, notes, type, user_rating, last_watched_at, watched_count, done, status, current_season, current_episode, tmdb_id, poster_path
  `

  return NextResponse.json(mapRow(rows[0] as WatchlistRow), { status: 201 })
}

export async function PATCH(request: Request) {
  const unauthorized = await requireMediaGuideSession()
  if (unauthorized) return unauthorized

  const payload = (await request.json()) as WatchlistPayload
  if (!payload.id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  }

  const sql = await getSql()
  const userRating = normalizeRating(payload.userRating)
  const rows = await sql`
    update media_watchlist
    set done = coalesce(${payload.done ?? null}, done),
        status = coalesce(${payload.status ?? null}, status),
        user_rating = coalesce(${userRating}, user_rating),
        last_watched_at = coalesce(${payload.lastWatchedAt || null}, last_watched_at),
        watched_count = coalesce(${payload.watchedCount ?? null}, watched_count),
        current_season = coalesce(${payload.currentSeason ?? null}, current_season),
        current_episode = coalesce(${payload.currentEpisode ?? null}, current_episode),
        tmdb_id = coalesce(${payload.tmdbId ?? null}, tmdb_id)
    where id = ${payload.id}
    returning id, title, service, next_episode, cadence, notes, type, user_rating, last_watched_at, watched_count, done, status, current_season, current_episode, tmdb_id, poster_path
  `

  if (!rows.length) {
    return NextResponse.json({ error: 'watchlist item not found.' }, { status: 404 })
  }

  return NextResponse.json(mapRow(rows[0] as WatchlistRow))
}

export async function DELETE(request: Request) {
  const unauthorized = await requireMediaGuideSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  }

  const sql = await getSql()
  await sql`delete from media_watchlist where id = ${id}`

  return new NextResponse(null, { status: 204 })
}

async function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const sql = neon(process.env.DATABASE_URL)
  await ensureTable(sql)
  return sql
}

async function ensureTable(sql: NeonQueryFunction<false, false>) {
  await sql`
    create table if not exists media_watchlist (
      id uuid primary key,
      title text not null,
      service text,
      next_episode date,
      cadence text,
      notes text,
      type text default 'show',
      user_rating int,
      last_watched_at date,
      watched_count int default 0,
      status text,
      done boolean default false,
      created_at timestamp default current_timestamp
    )
  `
  await sql`alter table media_watchlist add column if not exists status text`
  await sql`alter table media_watchlist add column if not exists type text default 'show'`
  await sql`alter table media_watchlist add column if not exists user_rating int`
  await sql`alter table media_watchlist add column if not exists last_watched_at date`
  await sql`alter table media_watchlist add column if not exists watched_count int default 0`
  await sql`alter table media_watchlist add column if not exists current_season int default 1`
  await sql`alter table media_watchlist add column if not exists current_episode int default 0`
  await sql`alter table media_watchlist add column if not exists tmdb_id int`
  await sql`alter table media_watchlist add column if not exists poster_path text`
}

function mapRow(row: WatchlistRow) {
  return {
    id: row.id,
    title: row.title,
    service: row.service ?? '',
    nextEpisode: row.next_episode ?? new Date().toISOString().slice(0, 10),
    cadence: row.cadence ?? 'Unknown',
    notes: row.notes ?? '',
    type: row.type ?? 'show',
    userRating: row.user_rating ?? null,
    lastWatchedAt: row.last_watched_at ?? null,
    watchedCount: row.watched_count ?? 0,
    done: row.done,
    status: row.status ?? (row.done ? 'completed' : 'watching'),
    currentSeason: row.current_season ?? 1,
    currentEpisode: row.current_episode ?? 0,
    tmdbId: row.tmdb_id ?? null,
    posterPath: row.poster_path ?? null,
  }
}

function normalizeRating(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  return Math.min(5, Math.max(1, Math.round(value)))
}

async function requireMediaGuideSession() {
  if (await hasMediaGuideSession()) {
    return null
  }

  return NextResponse.json(
    { error: 'Runway login required.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  )
}
