import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'
import { ensureRecommendationTables, getMediaGuideSql } from '@/lib/media-guide-db'

type RecommendationPayload = {
  action?: 'create-list' | 'rename-list' | 'add-item' | 'move-item' | 'delete-list' | 'delete-item'
  listId?: string
  itemId?: string
  name?: string
  item?: {
    tmdbId?: number
    mediaType?: string
    status?: string
    title?: string
    service?: string
    posterPath?: string | null
    overview?: string
    note?: string
  }
}

export async function GET() {
  const unauthorized = await requireMediaGuideSession()
  if (unauthorized) return unauthorized

  const sql = getMediaGuideSql()
  await ensureRecommendationTables(sql)
  const [lists, items] = await Promise.all([
    sql`
      select id, name, share_slug
      from media_recommendation_lists
      order by created_at desc
    `,
    sql`
      select id, list_id, tmdb_id, media_type, status, title, service, poster_path, overview, note
      from media_recommendation_items
      order by created_at desc
    `,
  ])

  return NextResponse.json({
    lists: lists.map(mapList),
    items: items.map(mapItem),
  })
}

export async function POST(request: Request) {
  const unauthorized = await requireMediaGuideSession()
  if (unauthorized) return unauthorized

  const payload = (await request.json()) as RecommendationPayload
  const sql = getMediaGuideSql()
  await ensureRecommendationTables(sql)

  if (payload.action === 'create-list') {
    const name = payload.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    const rows = await sql`
      insert into media_recommendation_lists (id, name, share_slug)
      values (${crypto.randomUUID()}, ${name}, ${makeSlug(name)})
      returning id, name, share_slug
    `
    return NextResponse.json(mapList(rows[0]), { status: 201 })
  }

  if (payload.action === 'delete-list') {
    if (!payload.listId) return NextResponse.json({ error: 'listId is required.' }, { status: 400 })
    await sql`delete from media_recommendation_lists where id = ${payload.listId}`
    return new NextResponse(null, { status: 204 })
  }

  if (payload.action === 'rename-list') {
    if (!payload.listId) return NextResponse.json({ error: 'listId is required.' }, { status: 400 })
    const name = payload.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    const rows = await sql`
      update media_recommendation_lists
      set name = ${name}
      where id = ${payload.listId}
      returning id, name, share_slug
    `
    if (!rows.length) return NextResponse.json({ error: 'list not found.' }, { status: 404 })
    return NextResponse.json(mapList(rows[0]))
  }

  if (payload.action === 'delete-item') {
    if (!payload.itemId) return NextResponse.json({ error: 'itemId is required.' }, { status: 400 })
    await sql`delete from media_recommendation_items where id = ${payload.itemId}`
    return new NextResponse(null, { status: 204 })
  }

  if (payload.action === 'move-item') {
    if (!payload.itemId) return NextResponse.json({ error: 'itemId is required.' }, { status: 400 })
    const rows = await sql`
      update media_recommendation_items
      set list_id = ${payload.listId || null}
      where id = ${payload.itemId}
      returning id, list_id, tmdb_id, media_type, status, title, service, poster_path, overview, note
    `
    if (!rows.length) return NextResponse.json({ error: 'item not found.' }, { status: 404 })
    return NextResponse.json(mapItem(rows[0]))
  }

  if (payload.action === 'add-item') {
    const item = payload.item
    if (!item?.title?.trim() || !item.status) {
      return NextResponse.json({ error: 'item title and status are required.' }, { status: 400 })
    }

    const rows = await sql`
      insert into media_recommendation_items (
        id, list_id, tmdb_id, media_type, status, title, service, poster_path, overview, note
      )
      values (
        ${crypto.randomUUID()},
        ${payload.listId || null},
        ${item.tmdbId ?? null},
        ${item.mediaType ?? 'movie'},
        ${item.status},
        ${item.title.trim()},
        ${item.service ?? ''},
        ${item.posterPath ?? null},
        ${item.overview ?? ''},
        ${item.note ?? ''}
      )
      returning id, list_id, tmdb_id, media_type, status, title, service, poster_path, overview, note
    `

    return NextResponse.json(mapItem(rows[0]), { status: 201 })
  }

  return NextResponse.json({ error: 'unknown action.' }, { status: 400 })
}

function mapList(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    shareSlug: String(row.share_slug),
  }
}

function mapItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    listId: row.list_id ? String(row.list_id) : null,
    tmdbId: row.tmdb_id ? Number(row.tmdb_id) : null,
    mediaType: row.media_type ? String(row.media_type) : '',
    status: String(row.status),
    title: String(row.title),
    service: row.service ? String(row.service) : '',
    posterPath: row.poster_path ? String(row.poster_path) : null,
    overview: row.overview ? String(row.overview) : '',
    note: row.note ? String(row.note) : '',
  }
}

function makeSlug(name: string) {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44)

  return `${clean || 'list'}-${crypto.randomUUID().slice(0, 8)}`
}

async function requireMediaGuideSession() {
  if (await hasMediaGuideSession()) return null

  return NextResponse.json(
    { error: 'Runway login required.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  )
}
