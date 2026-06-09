import { cookies } from 'next/headers'

export const mediaGuideSessionCookie = 'media_guide_session'

const maxSessionAgeMs = 1000 * 60 * 60 * 24 * 30

export async function hasMediaGuideSession() {
  const password = process.env.MEDIA_GUIDE_PASSWORD
  const secret = process.env.MEDIA_GUIDE_SESSION_SECRET ?? password
  const cookieStore = await cookies()
  const token = cookieStore.get(mediaGuideSessionCookie)?.value

  if (!password || !secret || !token) {
    return false
  }

  return isValidMediaGuideToken(token, password, secret)
}

export async function createMediaGuideSessionToken(password: string, secret: string) {
  const issuedAt = String(Date.now())
  const signature = await signToken(issuedAt, password, secret)
  return `${issuedAt}.${signature}`
}

async function isValidMediaGuideToken(token: string, password: string, secret: string) {
  const [issuedAt, signature] = token.split('.')
  const issued = Number(issuedAt)

  if (!issued || !signature || Date.now() - issued > maxSessionAgeMs) {
    return false
  }

  const expected = await signToken(issuedAt, password, secret)
  return signature === expected
}

async function signToken(issuedAt: string, password: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`media-guide:${issuedAt}:${password}`))
  return Buffer.from(signature).toString('base64url')
}
