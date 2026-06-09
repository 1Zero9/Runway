import { NextResponse } from 'next/server'
import { mediaGuideSessionCookie } from '@/lib/media-guide-auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(mediaGuideSessionCookie, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
