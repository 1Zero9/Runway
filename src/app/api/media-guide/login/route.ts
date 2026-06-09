import { NextResponse } from 'next/server'
import { createMediaGuideSessionToken, mediaGuideSessionCookie } from '@/lib/media-guide-auth'

const maxSessionAgeSeconds = 60 * 60 * 24 * 30

type LoginPayload = {
  password?: string
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginPayload
  const password = process.env.MEDIA_GUIDE_PASSWORD
  const secret = process.env.MEDIA_GUIDE_SESSION_SECRET ?? password

  if (!password || !secret) {
    return NextResponse.json({ error: 'Runway password is not configured.' }, { status: 500 })
  }

  if (payload.password !== password) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const token = await createMediaGuideSessionToken(password, secret)
  const response = NextResponse.json({ ok: true })

  response.cookies.set(mediaGuideSessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxSessionAgeSeconds,
  })

  return response
}
