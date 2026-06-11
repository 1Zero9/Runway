import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

const USER_ID = 'steve'

async function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.')
  const sql = neon(process.env.DATABASE_URL)
  await sql`
    create table if not exists runway_calendar_tokens (
      user_id text primary key,
      token text not null,
      created_at timestamp default current_timestamp
    )
  `
  return sql
}

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }
  const sql = await getSql()
  const rows = await sql`select token from runway_calendar_tokens where user_id = ${USER_ID}`
  if (!rows.length) {
    return NextResponse.json({ token: null })
  }
  return NextResponse.json({ token: rows[0].token as string })
}

export async function POST() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }
  const sql = await getSql()
  const token = crypto.randomUUID().replace(/-/g, '')
  await sql`
    insert into runway_calendar_tokens (user_id, token, created_at)
    values (${USER_ID}, ${token}, current_timestamp)
    on conflict (user_id) do update set token = ${token}, created_at = current_timestamp
  `
  return NextResponse.json({ token })
}
