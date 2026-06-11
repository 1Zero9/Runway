import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

export async function GET() {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = process.env.TMDB_API_KEY
  return NextResponse.json({
    defined: raw !== undefined,
    type: typeof raw,
    length: raw?.length ?? null,
    trimmedLength: raw?.trim().length ?? null,
    firstChar: raw?.trim()[0] ?? null,
  })
}
