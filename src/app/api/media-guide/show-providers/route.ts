import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'
import { getMediaGuideSql } from '@/lib/media-guide-db'
import { ensureRunwayTables, RUNWAY_USER_ID } from '@/lib/runway-db'
import type { RunwayShowProviderRow } from '@/lib/runway-db'

type ProviderPayload = {
  showId: string
  providerName: string
  isPrimary?: boolean
  leavingOn?: string | null  // ISO date string or null to clear
}

/** Upsert provider record; if isPrimary is true, demote all others first. */
export async function PATCH(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const body = (await request.json()) as ProviderPayload
  if (!body.showId || !body.providerName) {
    return NextResponse.json({ error: 'showId and providerName are required' }, { status: 400 })
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  if (body.isPrimary) {
    await sql`
      update runway_show_providers
      set is_primary = false
      where show_id = ${body.showId}
    `
  }

  const id = crypto.randomUUID()
  const rows = await sql`
    insert into runway_show_providers (id, show_id, provider_name, is_primary, leaving_on)
    values (
      ${id},
      ${body.showId},
      ${body.providerName},
      ${body.isPrimary ?? false},
      ${body.leavingOn ?? null}
    )
    on conflict (show_id, provider_name) do update set
      is_primary = excluded.is_primary,
      leaving_on = excluded.leaving_on
    returning id, show_id, provider_name, is_primary, leaving_on
  `

  return NextResponse.json({ provider: rows[0] as RunwayShowProviderRow })
}

export async function GET(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const showId = searchParams.get('showId')
  if (!showId) {
    return NextResponse.json({ error: 'showId is required' }, { status: 400 })
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  const rows = await sql`
    select id, show_id, provider_name, is_primary, leaving_on
    from runway_show_providers
    where show_id = ${showId}
    order by is_primary desc, created_at asc
  `

  return NextResponse.json({ providers: rows as RunwayShowProviderRow[] })
}

export async function DELETE(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const showId = searchParams.get('showId')
  const providerName = searchParams.get('providerName')
  if (!showId || !providerName) {
    return NextResponse.json({ error: 'showId and providerName are required' }, { status: 400 })
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  await sql`
    delete from runway_show_providers
    where show_id = ${showId} and provider_name = ${providerName}
  `

  return new NextResponse(null, { status: 204 })
}
