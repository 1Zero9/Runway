// Adds a real TMDb show via the search overlay so poster_path is stored in the DB.
// Then re-takes Phase 4 acceptance screenshots with real artwork.
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
  await page.waitForTimeout(2000)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
  console.log('saved', name)
}

const browser = await chromium.launch({ headless: true })

// Step 1: Track "Slow Horses" via the search overlay
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await login(page)

  // Open search overlay
  await page.keyboard.press('Meta+k')
  await page.waitForSelector('.search-overlay-panel', { timeout: 5000 })
  await page.waitForTimeout(300)

  // Search for Slow Horses
  await page.keyboard.type('Slow Horses')
  console.log('Searching for Slow Horses...')

  // Wait for TMDb results to appear
  await page.waitForTimeout(1500)

  // Click the Track (T) button on the first TMDb result
  const trackBtns = page.locator('.search-action-btn').filter({ hasText: 'Track' })
  const count = await trackBtns.count()
  console.log(`Found ${count} Track buttons`)

  if (count > 0) {
    await trackBtns.first().click()
    console.log('Clicked Track on first TMDb result')
    await page.waitForTimeout(2000)
  } else {
    // Fallback: try keyboard shortcut T on highlighted result
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('t')
    await page.waitForTimeout(2000)
  }

  // Close overlay
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // Also search and track Severance for a second card
  await page.keyboard.press('Meta+k')
  await page.waitForSelector('.search-overlay-panel', { timeout: 5000 })
  await page.waitForTimeout(300)
  await page.keyboard.type('Severance')
  console.log('Searching for Severance...')
  await page.waitForTimeout(1500)

  const trackBtns2 = page.locator('.search-action-btn').filter({ hasText: 'Track' })
  const count2 = await trackBtns2.count()
  console.log(`Found ${count2} Track buttons for Severance`)
  if (count2 > 0) {
    await trackBtns2.first().click()
    console.log('Clicked Track on Severance')
    await page.waitForTimeout(2000)
  }

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  await ctx.close()
}

// Step 2: Reload dashboard and take acceptance screenshots
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await login(page)

  // Wait for shortlist to populate with real data
  await page.waitForTimeout(3000)

  await shot(page, 'phase4-final-1280-masthead.png')

  // Hover first shortlist card to show action
  const card = page.locator('.shortlist-card').first()
  if (await card.count()) {
    await card.hover()
    await page.waitForTimeout(250)
    await shot(page, 'phase4-final-1280-shortlist-hover.png')
  }

  // Scroll to continue watching
  await page.evaluate(() => {
    const el = document.querySelector('.continue-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await page.waitForTimeout(300)
  await shot(page, 'phase4-final-1280-continue.png')

  await ctx.close()
}

// Step 3: Mobile screenshots
{
  const ctx = await browser.newContext({
    ...devices['iPhone SE'],
    viewport: { width: 375, height: 667 },
  })
  const page = await ctx.newPage()
  await login(page)
  await page.waitForTimeout(2000)

  await shot(page, 'phase4-final-375-masthead.png')

  await page.evaluate(() => {
    const card = document.querySelector('.shortlist-card')
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'start' })
  })
  await page.waitForTimeout(200)
  await shot(page, 'phase4-final-375-shortlist.png')

  await page.evaluate(() => {
    const el = document.querySelector('.continue-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await page.waitForTimeout(200)
  await shot(page, 'phase4-final-375-continue.png')

  await ctx.close()
}

await browser.close()
console.log('Done. Screenshots in docs/screenshots/')
