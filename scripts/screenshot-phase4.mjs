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
  await page.waitForTimeout(2500)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
  console.log('saved', name)
}

const browser = await chromium.launch()

// 1280px desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await login(page)

  // Above the fold: masthead + shortlist
  await shot(page, 'phase4-desktop-masthead.png')

  // Hover first shortlist card
  const card = page.locator('.shortlist-card').first()
  if (await card.count()) {
    await card.hover()
    await page.waitForTimeout(200)
    await shot(page, 'phase4-desktop-shortlist-hover.png')
  }

  // Scroll to Continue watching section
  await page.evaluate(() => {
    const el = document.querySelector('.continue-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await page.waitForTimeout(300)
  await shot(page, 'phase4-desktop-continue.png')

  await ctx.close()
}

// 375px mobile (iPhone SE emulation — coarse pointer)
{
  const ctx = await browser.newContext({
    ...devices['iPhone SE'],
    viewport: { width: 375, height: 667 },
  })
  const page = await ctx.newPage()
  await login(page)
  await shot(page, 'phase4-mobile-masthead.png')

  // Scroll to shortlist card footer to see action button (always visible on coarse)
  await page.evaluate(() => {
    const card = document.querySelector('.shortlist-card')
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'start' })
  })
  await page.waitForTimeout(200)
  await shot(page, 'phase4-mobile-shortlist.png')

  // Scroll to Continue watching
  await page.evaluate(() => {
    const el = document.querySelector('.continue-rail')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await page.waitForTimeout(300)
  await shot(page, 'phase4-mobile-continue.png')

  await ctx.close()
}

await browser.close()
console.log('Done — screenshots in docs/screenshots/')
