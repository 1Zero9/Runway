import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'

const USER_ID = 'steve'

type WatchlistRow = {
  id: string
  title: string
  service: string | null
  type: string | null
  status: string | null
  done: boolean
  next_episode: string | null
  leaving_date: string | null
  current_season: number | null
  current_episode: number | null
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!process.env.DATABASE_URL) {
    return new NextResponse('Server error', { status: 500 })
  }

  const sql = neon(process.env.DATABASE_URL)

  const tokenRows = await sql`
    select token from runway_calendar_tokens where user_id = ${USER_ID} and token = ${token}
  `
  if (!tokenRows.length) {
    return new NextResponse('Invalid or expired calendar token.', { status: 404 })
  }

  const rows = (await sql`
    select id, title, service, type, status, done, next_episode, leaving_date, current_season, current_episode
    from media_watchlist
    where (status not in ('completed', 'dropped') or status is null)
    order by next_episode asc nulls last
  `) as WatchlistRow[]

  const events: string[] = []

  for (const row of rows) {
    const service = row.service ?? ''

    // Next episode air date
    if (row.next_episode && row.type !== 'film') {
      const season = row.current_season ?? 1
      const episode = (row.current_episode ?? 0) + 1
      const epLabel = `S${String(season).padStart(2, '0')} E${String(episode).padStart(2, '0')}`
      events.push(makeEvent({
        uid: `runway-next-${row.id}`,
        dtstart: row.next_episode.replace(/-/g, ''),
        summary: `${row.title} ${epLabel} · ${service}`,
      }))
    }

    // Film release
    if (row.next_episode && row.type === 'film') {
      events.push(makeEvent({
        uid: `runway-film-${row.id}`,
        dtstart: row.next_episode.replace(/-/g, ''),
        summary: `${row.title} · ${service}`,
      }))
    }

    // Leaving date deadline
    if (row.leaving_date) {
      events.push(makeEvent({
        uid: `runway-leaving-${row.id}`,
        dtstart: row.leaving_date.replace(/-/g, ''),
        summary: `⚠ ${row.title} leaves ${service}`,
      }))
    }
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Runway//Runway TV Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Runway TV',
    'X-WR-CALDESC:Your tracked shows and cinema releases',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="runway.ics"',
      'Cache-Control': 'no-store',
    },
  })
}

function makeEvent({ uid, dtstart, summary }: { uid: string; dtstart: string; summary: string }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@runway`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:${foldLine(escapeIcs(summary))}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    'END:VEVENT',
  ].join('\r\n')
}

function escapeIcs(str: string) {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function foldLine(str: string) {
  // RFC 5545 §3.1: fold lines at 75 octets
  if (str.length <= 75) return str
  const chunks: string[] = []
  let i = 0
  while (i < str.length) {
    chunks.push((i === 0 ? '' : ' ') + str.slice(i, i + (i === 0 ? 75 : 74)))
    i += i === 0 ? 75 : 74
  }
  return chunks.join('\r\n')
}
