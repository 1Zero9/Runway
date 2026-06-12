import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

export const dynamic = 'force-dynamic'

type TasteRow = {
  title: string
  service: string | null
  sentiment: string | null
  watched_era: string | null
  favourited_at: string | null
}

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ anchors: [], providerWeights: {}, eraWeights: {} })
  }

  const sql = neon(process.env.DATABASE_URL)

  const rows = await sql`
    select title, service, sentiment, watched_era, favourited_at
    from media_watchlist
    where sentiment is not null or favourited_at is not null
    order by
      case sentiment when 'loved' then 1 when 'liked' then 2 else 3 end,
      favourited_at desc nulls last
  ` as TasteRow[]

  // Weighted anchors for recommendation reason lines
  // loved=3, favourite bonus=+2, liked=1, not_for_me=-2
  const anchors: { title: string; weight: number; sentiment: string }[] = []
  const providerWeights: Record<string, number> = {}
  const eraWeights: Record<string, number> = {}

  for (const row of rows) {
    const sentiment = row.sentiment
    if (!sentiment || sentiment === 'not_for_me') continue

    const baseWeight = sentiment === 'loved' ? 3 : 1
    const favBonus = row.favourited_at ? 2 : 0
    const weight = baseWeight + favBonus

    anchors.push({ title: row.title, weight, sentiment })

    if (row.service) {
      providerWeights[row.service] = (providerWeights[row.service] ?? 0) + weight
    }
    if (row.watched_era) {
      eraWeights[row.watched_era] = (eraWeights[row.watched_era] ?? 0) + weight
    }
  }

  // Top anchors (loved + favourite first) for reason lines
  const topAnchors = anchors
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)

  return NextResponse.json({ anchors: topAnchors, providerWeights, eraWeights })
}
