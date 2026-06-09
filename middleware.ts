import { NextResponse, type NextRequest } from 'next/server'

const sessionCookie = 'media_guide_session'
const maxSessionAgeMs = 1000 * 60 * 60 * 24 * 30

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/media-guide/')
  const isPublicAsset =
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/runway-icon') ||
    pathname === '/runway.webmanifest' ||
    pathname === '/runway-sw.js'

  if (isPublicAsset) {
    return NextResponse.next()
  }

  if (
    pathname === '/login' ||
    pathname === '/api/media-guide/login' ||
    pathname.startsWith('/share/')
  ) {
    return NextResponse.next()
  }

  const password = process.env.MEDIA_GUIDE_PASSWORD
  const secret = process.env.MEDIA_GUIDE_SESSION_SECRET ?? password
  const token = request.cookies.get(sessionCookie)?.value

  if (password && secret && token && (await isValidToken(token, password, secret))) {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (isApi) {
    return NextResponse.json(
      { error: 'Runway login required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', pathname)
  const response = NextResponse.redirect(loginUrl)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}

async function isValidToken(token: string, password: string, secret: string) {
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
  return bytesToBase64Url(new Uint8Array(signature))
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
