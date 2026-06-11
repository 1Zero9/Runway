import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'
import { getMediaGuideSql } from '@/lib/media-guide-db'
import { ensureRunwayTables, RUNWAY_USER_ID } from '@/lib/runway-db'

type LogTapPayload = {
  mode: 'tap'
  episodeId: string
}

type LogBulkPayload = {
  mode: 'bulk'
  showId: string
  targetSeason: number
  targetEpisode: number
}

type LogPayload = LogTapPayload | LogBulkPayload

export async function POST(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const body = (await request.json()) as LogPayload
  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  if (body.mode === 'tap') {
    if (!body.episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 })
    }

    const eventId = crypto.randomUUID()
    await sql`
      insert into runway_watch_events (id, user_id, episode_id, source)
      values (${eventId}, ${RUNWAY_USER_ID}, ${body.episodeId}, 'tap')
    `
    return NextResponse.json({ ok: true, eventId }, { status: 201 })
  }

  if (body.mode === 'bulk') {
    if (!body.showId || !body.targetSeason || !body.targetEpisode) {
      return NextResponse.json({ error: 'showId, targetSeason, targetEpisode are required' }, { status: 400 })
    }

    // Insert watch events for all episodes up to the target, skipping already-watched ones.
    // ON CONFLICT is not applicable since the table has no unique constraint (rewatches allowed),
    // so we explicitly filter out already-watched episodes.
    const inserted = await sql`
      insert into runway_watch_events (id, user_id, episode_id, source)
      select gen_random_uuid(), ${RUNWAY_USER_ID}, e.id, 'bulk'
      from runway_episodes e
      where e.show_id = ${body.showId}
        and e.season > 0
        and (
          e.season < ${body.targetSeason}
          or (e.season = ${body.targetSeason} and e.episode <= ${body.targetEpisode})
        )
        and not exists (
          select 1 from runway_watch_events we
          where we.episode_id = e.id
            and we.user_id = ${RUNWAY_USER_ID}
        )
      returning id
    `
    return NextResponse.json({ ok: true, inserted: inserted.length }, { status: 201 })
  }

  return NextResponse.json({ error: 'mode must be "tap" or "bulk"' }, { status: 400 })
}

export async function DELETE(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const episodeId = searchParams.get('episodeId')
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 })
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  // Remove the most recent watch event for this episode (unlog one rewatch at a time)
  await sql`
    delete from runway_watch_events
    where id = (
      select id from runway_watch_events
      where episode_id = ${episodeId}
        and user_id = ${RUNWAY_USER_ID}
      order by watched_at desc
      limit 1
    )
  `

  return new NextResponse(null, { status: 204 })
}
