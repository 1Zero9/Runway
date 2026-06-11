import type { MediaGuideSql } from './media-guide-db'

export const RUNWAY_USER_ID = 'steve'

// ── Row types ────────────────────────────────────────────────────────────────

export type RunwayShowRow = {
  id: string
  user_id: string
  tmdb_id: number
  title: string
  poster_path: string | null
  backdrop_path: string | null
  dominant_colour: string | null
  status: string | null
  next_air_date: string | null
  created_at: string
}

export type RunwayEpisodeRow = {
  id: string
  show_id: string
  season: number
  episode: number
  title: string | null
  air_date: string | null
  runtime: number | null
}

export type RunwayWatchEventRow = {
  id: string
  user_id: string
  episode_id: string
  watched_at: string
  source: string
}

export type RunwayShowProviderRow = {
  id: string
  show_id: string
  provider_name: string
  is_primary: boolean
  leaving_on: string | null
}

export type RunwayMovieRow = {
  id: string
  user_id: string
  tmdb_id: number
  title: string
  poster_path: string | null
  backdrop_path: string | null
  dominant_colour: string | null
  ie_release_date: string | null
  watched_at: string | null
  watchlisted_at: string | null
  created_at: string
}

export type DashboardShowRow = RunwayShowRow & {
  watched_count: number
  total_episodes: number
  minutes_remaining: number
  last_watched_at: string | null
  next_season: number | null
  next_episode_num: number | null
  next_episode_title: string | null
  next_episode_runtime: number | null
  provider_name: string | null
  leaving_on: string | null
  days_until_leaving: number | null
  is_caught_up: boolean
}

// ── Schema creation ──────────────────────────────────────────────────────────

export async function ensureRunwayTables(sql: MediaGuideSql) {
  await sql`
    create table if not exists runway_shows (
      id uuid primary key,
      user_id text not null default 'steve',
      tmdb_id int not null,
      title text not null,
      poster_path text,
      backdrop_path text,
      dominant_colour text,
      status text,
      next_air_date date,
      created_at timestamptz default now(),
      unique (user_id, tmdb_id)
    )
  `

  await sql`
    create table if not exists runway_show_providers (
      id uuid primary key,
      show_id uuid references runway_shows(id) on delete cascade,
      provider_name text not null,
      is_primary boolean default false,
      leaving_on date,
      created_at timestamptz default now(),
      unique (show_id, provider_name)
    )
  `

  await sql`
    create table if not exists runway_episodes (
      id uuid primary key,
      show_id uuid references runway_shows(id) on delete cascade,
      season int not null,
      episode int not null,
      title text,
      air_date date,
      runtime int,
      synced_at timestamptz default now(),
      unique (show_id, season, episode)
    )
  `

  await sql`
    create table if not exists runway_watch_events (
      id uuid primary key,
      user_id text not null default 'steve',
      episode_id uuid references runway_episodes(id) on delete cascade,
      watched_at timestamptz default now(),
      source text not null default 'tap'
    )
  `

  await sql`
    create table if not exists runway_movies (
      id uuid primary key,
      user_id text not null default 'steve',
      tmdb_id int not null,
      title text not null,
      poster_path text,
      backdrop_path text,
      dominant_colour text,
      ie_release_date date,
      watched_at timestamptz,
      watchlisted_at timestamptz default now(),
      created_at timestamptz default now(),
      unique (user_id, tmdb_id)
    )
  `
}

// ── Dashboard query ──────────────────────────────────────────────────────────

export async function queryDashboard(sql: MediaGuideSql, userId = RUNWAY_USER_ID): Promise<DashboardShowRow[]> {
  const rows = await sql`
    with
    watched_eps as (
      select we.episode_id, max(we.watched_at) as last_watched_at
      from runway_watch_events we
      where we.user_id = ${userId}
      group by we.episode_id
    ),
    show_progress as (
      select
        e.show_id,
        count(*) filter (where e.season > 0) as total_episodes,
        count(we.episode_id) filter (where e.season > 0) as watched_count,
        coalesce(sum(e.runtime) filter (where e.season > 0 and we.episode_id is null), 0) as minutes_remaining,
        max(we.last_watched_at) as last_watched_at
      from runway_episodes e
      left join watched_eps we on we.episode_id = e.id
      group by e.show_id
    ),
    next_unwatched as (
      select distinct on (e.show_id)
        e.show_id,
        e.id as episode_id,
        e.season as next_season,
        e.episode as next_episode_num,
        e.title as next_episode_title,
        e.runtime as next_episode_runtime
      from runway_episodes e
      left join watched_eps we on we.episode_id = e.id
      where e.season > 0 and we.episode_id is null
      order by e.show_id, e.season, e.episode
    ),
    primary_provider as (
      select distinct on (show_id)
        show_id,
        provider_name,
        leaving_on,
        case when leaving_on is not null
          then (leaving_on - current_date)::int
        end as days_until_leaving
      from runway_show_providers
      where is_primary = true
      order by show_id, created_at desc
    )
    select
      s.id,
      s.user_id,
      s.tmdb_id,
      s.title,
      s.poster_path,
      s.backdrop_path,
      s.dominant_colour,
      s.status,
      s.next_air_date,
      s.created_at,
      coalesce(sp.watched_count, 0)::int as watched_count,
      coalesce(sp.total_episodes, 0)::int as total_episodes,
      coalesce(sp.minutes_remaining, 0)::int as minutes_remaining,
      sp.last_watched_at,
      nu.next_season,
      nu.next_episode_num,
      nu.next_episode_title,
      nu.next_episode_runtime,
      pp.provider_name,
      pp.leaving_on,
      pp.days_until_leaving,
      (nu.episode_id is null) as is_caught_up
    from runway_shows s
    left join show_progress sp on sp.show_id = s.id
    left join next_unwatched nu on nu.show_id = s.id
    left join primary_provider pp on pp.show_id = s.id
    where s.user_id = ${userId}
    order by sp.last_watched_at desc nulls last, s.created_at desc
  `
  return rows as DashboardShowRow[]
}
