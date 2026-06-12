// Adds real shows with TMDb poster_path directly via the watchlist API
const BASE = 'http://localhost:3002'
const PASSWORD = 'Du8l!n!09C!tY'

// Login and get session cookie
const loginRes = await fetch(`${BASE}/api/media-guide/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
})
if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`)
const setCookie = loginRes.headers.get('set-cookie')
const sessionCookie = setCookie?.split(';')[0] ?? ''
console.log('Logged in, cookie:', sessionCookie.slice(0, 40) + '...')

const headers = { 'Content-Type': 'application/json', Cookie: sessionCookie }

const shows = [
  {
    title: 'Slow Horses',
    service: 'Apple TV+',
    type: 'show',
    tmdbId: 95480,
    posterPath: '/5RuZZIouptatjV96BdPmKmRsnGg.jpg',
    status: 'watching',
    relationship: 'tracking',
    currentSeason: 1,
    currentEpisode: 1,
  },
  {
    title: 'Severance',
    service: 'Apple TV+',
    type: 'show',
    tmdbId: 95396,
    posterPath: '/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg',
    status: 'watching',
    relationship: 'tracking',
    currentSeason: 1,
    currentEpisode: 1,
  },
]

for (const show of shows) {
  const res = await fetch(`${BASE}/api/media-guide/watchlist`, {
    method: 'POST',
    headers,
    body: JSON.stringify(show),
  })
  const body = await res.json().catch(() => ({}))
  if (res.ok) {
    console.log(`✓ Added ${show.title} (id: ${body.id ?? '?'})`)
  } else {
    console.log(`✗ ${show.title}: ${res.status}`, body)
  }
}
