import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

export type MediaGuideSql = NeonQueryFunction<false, false>

export function getMediaGuideSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  return neon(process.env.DATABASE_URL)
}

export async function ensureRecommendationTables(sql: MediaGuideSql) {
  await sql`
    create table if not exists media_recommendation_lists (
      id uuid primary key,
      name text not null,
      share_slug text unique not null,
      created_at timestamp default current_timestamp
    )
  `

  await sql`
    create table if not exists media_recommendation_items (
      id uuid primary key,
      list_id uuid references media_recommendation_lists(id) on delete cascade,
      tmdb_id int,
      media_type text,
      status text not null,
      title text not null,
      service text,
      poster_path text,
      overview text,
      note text,
      created_at timestamp default current_timestamp
    )
  `
}
