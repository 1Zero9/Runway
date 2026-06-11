import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'
import { getMediaGuideSql } from '@/lib/media-guide-db'
import { ensureRunwayTables, queryDashboard } from '@/lib/runway-db'

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json(
      { error: 'Runway login required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const sql = getMediaGuideSql()
  await ensureRunwayTables(sql)

  const shows = await queryDashboard(sql)

  return NextResponse.json(
    { shows, refreshedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
