import { chromium, devices } from '@playwright/test'
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
    const tiles = Array.from(document.querySelectorAll('.tile-title'))
    return tiles.length > 0 && tiles.every(el => !el.textContent?.includes('Example:'))
  }, { timeout: 15000 }).catch(() => console.warn('real-data timeout'))
}

async function waitForDiscovery(page) {
  await page.waitForFunction(() => {
    return document.querySelector('.discovery-rail') !== null
  }, { timeout: 12000 }).catch(() => console.warn('discovery timeout'))
  await page.waitForTimeout(500)
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
  await page.waitForTimeout(300)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
  console.log('saved', name)
}

const browser = await chromium.launch({ headless: true })

// 1280px desktop
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    hasTouch: false,
  })
  const page = await ctx.newPage()
  await login(page)
  await waitForRealData(page)
  await waitForDiscovery(page)
  await waitForImages(page)

  await shot(page, 'phase4-final-1280-masthead.png')

  await page.mouse.move(640, 450)
  await page.waitForTimeout(200)
  await shot(page, 'phase4-final-1280-resting.png')

  // Hover first tile
  const tile = page.locator('.shortlist-tile').first()
  if (await tile.count()) {
    await tile.hover()
    await page.waitForTimeout(300)
    await shot(page, 'phase4-final-1280-shortlist-hover.png')
  }

  // Scroll to continue watching
  await page.evaluate(() => {
    const el = document.querySelector('.continue-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await waitForImages(page)
  await shot(page, 'phase4-final-1280-continue.png')

  // Scroll to discovery rails
  await page.evaluate(() => {
    const el = document.querySelector('.discovery-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  })
  await waitForImages(page)
  await shot(page, 'phase4-final-1280-discovery.png')

  await ctx.close()
}

// 375px iPhone SE (coarse pointer)
{
  const ctx = await browser.newContext({
    ...devices['iPhone SE'],
    viewport: { width: 375, height: 667 },
  })
  const page = await ctx.newPage()
  await login(page)
  await waitForRealData(page)
  await waitForDiscovery(page)
  await waitForImages(page)

  await shot(page, 'phase4-final-375-masthead.png')

  await page.evaluate(() => {
    const tile = document.querySelector('.shortlist-tile')
    if (tile) tile.scrollIntoView({ behavior: 'instant', block: 'start' })
  })
  await waitForImages(page)
  await shot(page, 'phase4-final-375-shortlist.png')

  await page.evaluate(() => {
    const el = document.querySelector('.continue-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await waitForImages(page)
  await shot(page, 'phase4-final-375-continue.png')

  await ctx.close()
}

await browser.close()
console.log('Done.')
