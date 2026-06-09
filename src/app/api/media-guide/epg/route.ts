import { gunzipSync } from 'node:zlib'
import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

type EpgChannel = {
  id: string
  icon?: string
  name: string
}

const epgUrl = 'https://epgshare01.online/epgshare01/epg_ripper_IE1.xml.gz'
let cachedXml = ''
let cacheExpires = 0

export async function GET(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json(
      { error: 'Runway login required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const channelIds = searchParams
    .get('channels')
    ?.split(',')
    .map((channel) => channel.trim())
    .filter(Boolean)
  const xml = await getXml()
  const channels = parseChannels(xml)
  const schedule = parseProgrammes(xml, channels, date, channelIds)

  return NextResponse.json(
    {
      channels: Array.from(channels.values()).sort((a, b) => a.name.localeCompare(b.name)),
      source: 'epgshare01 IE1 XMLTV',
      schedule,
    },
    { headers: { 'Cache-Control': 'private, max-age=900' } },
  )
}

async function getXml() {
  if (cachedXml && Date.now() < cacheExpires) return cachedXml

  const response = await fetch(epgUrl, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Runway/1.0' },
  })
  if (!response.ok) throw new Error('Could not load EPG feed.')

  const compressed = Buffer.from(await response.arrayBuffer())
  cachedXml = gunzipSync(compressed).toString('utf8')
  cacheExpires = Date.now() + 1000 * 60 * 60 * 4
  return cachedXml
}

function parseChannels(xml: string) {
  const channels = new Map<string, EpgChannel>()
  const channelRegex = /<channel id="([^"]+)">([\s\S]*?)<\/channel>/g
  let match: RegExpExecArray | null

  while ((match = channelRegex.exec(xml))) {
    const [, id, body] = match
    const name = body.match(/<display-name[^>]*>([\s\S]*?)<\/display-name>/)?.[1]
    const icon = body.match(/<icon[^>]*src="([^"]+)"/)?.[1]
    const channelId = decodeXml(id)
    channels.set(channelId, {
      id: channelId,
      icon: icon ? decodeXml(icon) : undefined,
      name: decodeXml(stripTags(name || id)),
    })
  }

  return channels
}

function parseProgrammes(xml: string, channels: Map<string, EpgChannel>, date: string, channelIds?: string[]) {
  const rows = []
  const requestedChannels = channelIds?.length ? new Set(channelIds) : null
  const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g
  let match: RegExpExecArray | null
  let index = 0

  while ((match = programmeRegex.exec(xml))) {
    const [, attrs, body] = match
    const startRaw = attrs.match(/start="([^"]+)"/)?.[1]
    const stopRaw = attrs.match(/stop="([^"]+)"/)?.[1]
    const channelId = decodeXml(attrs.match(/channel="([^"]+)"/)?.[1] || '')
    if (!startRaw || !channelId) continue
    if (requestedChannels && !requestedChannels.has(channelId)) continue

    const start = parseXmltvDate(startRaw)
    if (formatIrelandDate(start) !== date) continue

    const stop = stopRaw ? parseXmltvDate(stopRaw) : null
    const channel = channels.get(channelId)
    const title = decodeXml(stripTags(body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || 'Untitled'))
    const subtitle = decodeXml(stripTags(body.match(/<sub-title[^>]*>([\s\S]*?)<\/sub-title>/)?.[1] || ''))
    const desc = decodeXml(stripTags(body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1] || ''))
    const category = decodeXml(stripTags(body.match(/<category[^>]*>([\s\S]*?)<\/category>/)?.[1] || ''))
    const icon = decodeXml(body.match(/<icon[^>]*src="([^"]+)"/)?.[1] || channel?.icon || '')

    rows.push({
      id: `${channelId}-${startRaw}-${index++}`,
      name: subtitle || category || desc.slice(0, 80) || title,
      season: 0,
      number: null,
      airtime: new Intl.DateTimeFormat('en-IE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Dublin',
      }).format(start),
      airstamp: start.toISOString(),
      runtime: stop ? Math.max(1, Math.round((stop.getTime() - start.getTime()) / 60000)) : null,
      show: {
        id: channelId,
        name: title,
        type: category || 'TV',
        language: 'English',
        image: icon ? { medium: icon } : undefined,
        network: { name: channel?.name || channelId },
      },
    })
  }

  return rows.sort((a, b) => a.airstamp.localeCompare(b.airstamp)).slice(0, requestedChannels ? 1800 : 900)
}

function parseXmltvDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-])(\d{2})(\d{2})$/)
  if (!match) return new Date(value)
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * 60000
  return new Date(sign === '+' ? utc - offset : utc + offset)
}

function formatIrelandDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Dublin',
    year: 'numeric',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
