import { chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../docs/screenshots')
fs.mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:3002'
const PASSWORD = 'Du8l!n!09C!tY'

async function login(page) {
  await page.goto(BASE)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/')
}

async function waitForRealData(page) {
  await page.waitForFunction(() => {
    const titles = Array.from(document.querySelectorAll('.shortlist-card-title, .continue-card-title'))
    return titles.length > 0 && titles.every(el => !el.textContent?.includes('Example:'))
  }, { timeout: 15000 }).catch(() => console.warn('real-data timeout'))
}

async function waitForImages(page) {
  await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    return Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve)
        img.addEventListener('error', resolve)
        setTimeout(resolve, 3000)
      })
    ))
  })
  await page.waitForTimeout(400)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
  console.log('saved', name)
}

// Get session cookie via login API
async function apiLogin() {
  const res = await fetch(`${BASE}/api/media-guide/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  return cookie
}

// Set lastWatchedAt on two items so that `topTitle` is more recent than `otherTitle`
async function setOrder(cookie, topTitle, otherTitle) {
  const listRes = await fetch(`${BASE}/api/media-guide/watchlist`, {
    headers: { Cookie: cookie },
  })
  const list = await listRes.json()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  for (const [title, date] of [[topTitle, today], [otherTitle, yesterday]]) {
    const item = list.find(i => i.title === title)
    if (!item) { console.warn(`Item not found: ${title}`); continue }
    await fetch(`${BASE}/api/media-guide/watchlist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ id: item.id, lastWatchedAt: date }),
    })
    console.log(`Set lastWatchedAt for "${title}" → ${date}`)
  }
}

const browser = await chromium.launch({ headless: true })

// -- Mood 1: Slow Horses is top pick --
{
  const cookie = await apiLogin()
  await setOrder(cookie, 'Slow Horses', 'Severance')
  await new Promise(r => setTimeout(r, 500))

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: false })
  const page = await ctx.newPage()
  await login(page)
  await waitForRealData(page)
  await waitForImages(page)
  await page.waitForTimeout(600) // hero crossfade
  await shot(page, 'phase5-mood-slowhorses.png')

  // Switch to Library tab and open a show detail to screenshot the backdrop tint
  const libraryTab = page.locator('.tabs .tab', { hasText: 'Library' })
  if (await libraryTab.count()) {
    await libraryTab.click()
    await page.waitForTimeout(400)
    // Click the first expand button (ChevronRight) in the library
    const expandBtn = page.locator('.watch-item-wrapper .icon-button').first()
    if (await expandBtn.count()) {
      await expandBtn.click()
      await page.waitForSelector('.show-detail-panel', { timeout: 5000 }).catch(() => console.warn('no detail panel'))
      await waitForImages(page)
      await page.waitForTimeout(400)
      // Scroll so the detail panel top is near the middle of viewport
      await page.evaluate(() => {
        const panel = document.querySelector('.show-detail-panel')
        if (panel) panel.scrollIntoView({ behavior: 'instant', block: 'start' })
      })
      await page.waitForTimeout(400)
      await shot(page, 'phase5-detail-tint-slowhorses.png')
    }
  }
  await ctx.close()
}

// -- Mood 2: Severance is top pick --
{
  const cookie = await apiLogin()
  await setOrder(cookie, 'Severance', 'Slow Horses')
  await new Promise(r => setTimeout(r, 500))

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: false })
  const page = await ctx.newPage()
  await login(page)
  await waitForRealData(page)
  await waitForImages(page)
  await page.waitForTimeout(600)
  await shot(page, 'phase5-mood-severance.png')
  await ctx.close()
}

await browser.close()
console.log('Done.')
