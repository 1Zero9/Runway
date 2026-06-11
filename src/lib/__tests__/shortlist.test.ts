import { describe, it, expect } from 'vitest'
import { buildShortlist } from '../shortlist'
import type { WatchlistItem, ShortlistContext, EpisodeCounts } from '../shortlist'

const TODAY = '2026-06-11'

function ctx(overrides?: Partial<ShortlistContext>): ShortlistContext {
  return { today: TODAY, ...overrides }
}

function item(overrides: Partial<WatchlistItem> & { id: string; title: string }): WatchlistItem {
  return {
    service: 'Netflix',
    done: false,
    status: 'watching',
    currentSeason: 1,
    currentEpisode: 3,
    lastWatchedAt: null,
    ...overrides,
  }
}

// ── LEAVING_SOON ──────────────────────────────────────────────────────────────

describe('LEAVING_SOON rule', () => {
  it('surfaces an in-progress show leaving within 14 days', () => {
    const items = [item({ id: '1', title: 'Silo', leavingDate: '2026-06-15' })]
    const result = buildShortlist(items, ctx())
    expect(result[0].rule).toBe('LEAVING_SOON')
    expect(result[0].reason).toMatch(/4 days/)
  })

  it('includes episode count in reason when counts available', () => {
    const counts = new Map<string, EpisodeCounts>([['1', { watched: 6, total: 10 }]])
    const items = [item({ id: '1', title: 'Silo', leavingDate: '2026-06-15' })]
    const result = buildShortlist(items, ctx({ episodeCounts: counts }))
    expect(result[0].reason).toMatch(/4 episodes/)
  })

  it('does not surface a show leaving in 15+ days', () => {
    const items = [item({ id: '1', title: 'Silo', leavingDate: '2026-06-30', lastWatchedAt: '2026-06-10' })]
    const result = buildShortlist(items, ctx())
    expect(result[0]?.rule).not.toBe('LEAVING_SOON')
  })
})

// ── FINISH_LINE ───────────────────────────────────────────────────────────────

describe('FINISH_LINE rule', () => {
  it('surfaces a show with ≤3 episodes left', () => {
    const counts = new Map<string, EpisodeCounts>([['1', { watched: 8, total: 10 }]])
    const items = [item({ id: '1', title: 'The Bear' })]
    const result = buildShortlist(items, ctx({ episodeCounts: counts }))
    expect(result[0].rule).toBe('FINISH_LINE')
    expect(result[0].reason).toMatch(/2 episodes/)
  })

  it('does not surface when >3 episodes left', () => {
    const counts = new Map<string, EpisodeCounts>([['1', { watched: 4, total: 10 }]])
    const items = [item({ id: '1', title: 'The Bear' })]
    const result = buildShortlist(items, ctx({ episodeCounts: counts }))
    expect(result[0]?.rule).not.toBe('FINISH_LINE')
  })

  it('does not surface when all episodes watched', () => {
    const counts = new Map<string, EpisodeCounts>([['1', { watched: 10, total: 10 }]])
    const items = [item({ id: '1', title: 'The Bear' })]
    const result = buildShortlist(items, ctx({ episodeCounts: counts }))
    expect(result.every((e) => e.rule !== 'FINISH_LINE')).toBe(true)
  })
})

// ── CONTINUE ──────────────────────────────────────────────────────────────────

describe('CONTINUE rule', () => {
  it('surfaces a recently watched show (within 14 days)', () => {
    const items = [item({ id: '1', title: 'Severance', lastWatchedAt: '2026-06-08' })]
    const result = buildShortlist(items, ctx())
    expect(result[0].rule).toBe('CONTINUE')
    expect(result[0].reason).toContain('S01 E03')
  })

  it('does not surface CONTINUE when last watched 15+ days ago', () => {
    const items = [item({ id: '1', title: 'Severance', lastWatchedAt: '2026-05-25' })]
    const result = buildShortlist(items, ctx())
    expect(result[0]?.rule).not.toBe('CONTINUE')
  })
})

// ── ON_TV_TONIGHT ─────────────────────────────────────────────────────────────

describe('ON_TV_TONIGHT rule', () => {
  it('surfaces a tracked show that is on TV tonight', () => {
    const items = [item({ id: '1', title: 'Ripper Street', status: 'waiting' })]
    const result = buildShortlist(items, ctx({ tvTonightTitles: new Set(['Ripper Street']) }))
    expect(result[0].rule).toBe('ON_TV_TONIGHT')
  })

  it('is case-insensitive for title matching', () => {
    const items = [item({ id: '1', title: 'ripper street', status: 'waiting' })]
    const result = buildShortlist(items, ctx({ tvTonightTitles: new Set(['Ripper Street']) }))
    expect(result[0].rule).toBe('ON_TV_TONIGHT')
  })
})

// ── STALLED ───────────────────────────────────────────────────────────────────

describe('STALLED rule', () => {
  it('surfaces a show untouched for 30+ days', () => {
    const items = [item({ id: '1', title: 'Dark', lastWatchedAt: '2026-04-01' })]
    const result = buildShortlist(items, ctx())
    expect(result[0].rule).toBe('STALLED')
    expect(result[0].reason).toMatch(/Still going/)
  })

  it('caps STALLED at one per shortlist', () => {
    const stale = ['1', '2', '3'].map((id) =>
      item({ id, title: `Show ${id}`, lastWatchedAt: '2026-03-01' }),
    )
    const result = buildShortlist(stale, ctx())
    expect(result.filter((e) => e.rule === 'STALLED').length).toBeLessThanOrEqual(2)
  })
})

// ── START_FRESH ───────────────────────────────────────────────────────────────

describe('START_FRESH rule', () => {
  it('surfaces a planned show', () => {
    const items = [item({ id: '1', title: 'Slow Horses', status: 'planned' })]
    const result = buildShortlist(items, ctx())
    expect(result[0].rule).toBe('START_FRESH')
    expect(result[0].reason).toContain('On your list')
  })

  it('shows waiting reason for waiting status', () => {
    const items = [item({ id: '1', title: 'Andor', status: 'waiting' })]
    const result = buildShortlist(items, ctx({ tvTonightTitles: new Set() }))
    const startFresh = result.find((e) => e.rule === 'START_FRESH')
    expect(startFresh?.reason).toContain('Waiting')
  })

  it('filters by userProviders when provided', () => {
    const items = [item({ id: '1', title: 'Andor', status: 'planned', service: 'Disney+' })]
    const result = buildShortlist(items, ctx({ userProviders: ['Netflix'] }))
    expect(result.find((e) => e.rule === 'START_FRESH')).toBeUndefined()
  })

  it('includes show when service matches userProviders', () => {
    const items = [item({ id: '1', title: 'Silo', status: 'planned', service: 'Apple TV+' })]
    const result = buildShortlist(items, ctx({ userProviders: ['Apple TV+'] }))
    expect(result.find((e) => e.rule === 'START_FRESH')).toBeDefined()
  })
})

// ── Composition ───────────────────────────────────────────────────────────────

describe('composition', () => {
  it('returns at most 5 entries', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      item({ id: String(i), title: `Show ${i}`, lastWatchedAt: '2026-06-10' }),
    )
    const result = buildShortlist(many, ctx())
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('LEAVING_SOON ranks above CONTINUE', () => {
    const items = [
      item({ id: '1', title: 'Leave Soon', leavingDate: '2026-06-15', lastWatchedAt: '2026-06-10' }),
      item({ id: '2', title: 'Continue Me', lastWatchedAt: '2026-06-11' }),
    ]
    const result = buildShortlist(items, ctx())
    expect(result[0].rule).toBe('LEAVING_SOON')
  })

  it('FINISH_LINE ranks above CONTINUE', () => {
    const counts = new Map<string, EpisodeCounts>([['1', { watched: 9, total: 10 }]])
    const items = [
      item({ id: '1', title: 'Almost Done' }),
      item({ id: '2', title: 'Continue Me', lastWatchedAt: '2026-06-11' }),
    ]
    const result = buildShortlist(items, ctx({ episodeCounts: counts }))
    expect(result[0].rule).toBe('FINISH_LINE')
  })

  it('skips completed and dropped shows', () => {
    const items = [
      item({ id: '1', title: 'Done', status: 'completed' }),
      item({ id: '2', title: 'Dropped', status: 'dropped' }),
    ]
    const result = buildShortlist(items, ctx())
    expect(result.length).toBe(0)
  })

  it('caps each rule at 2 entries', () => {
    const three = ['1', '2', '3'].map((id) =>
      item({ id, title: `Show ${id}`, lastWatchedAt: '2026-06-11' }),
    )
    const result = buildShortlist(three, ctx())
    expect(result.filter((e) => e.rule === 'CONTINUE').length).toBeLessThanOrEqual(2)
  })
})

// ── Time-fit ──────────────────────────────────────────────────────────────────

describe('time-fit filter', () => {
  it("'film' night returns only films when available", () => {
    const items = [
      item({ id: '1', title: 'A Show', lastWatchedAt: '2026-06-11' }),
      item({ id: '2', title: 'A Film', type: 'film', status: 'planned' }),
    ]
    const result = buildShortlist(items, ctx(), 'film')
    expect(result.every((e) => e.item.type === 'film')).toBe(true)
  })

  it("'film' night falls back to all when no films exist", () => {
    const items = [item({ id: '1', title: 'A Show', lastWatchedAt: '2026-06-11' })]
    const result = buildShortlist(items, ctx(), 'film')
    expect(result.length).toBeGreaterThan(0)
  })

  it("'30min' excludes items with avgRuntime > 35", () => {
    const counts = new Map<string, EpisodeCounts>([
      ['1', { watched: 0, total: 10, avgRuntime: 60 }],
      ['2', { watched: 0, total: 10, avgRuntime: 28 }],
    ])
    const items = [
      item({ id: '1', title: 'Drama', lastWatchedAt: '2026-06-11' }),
      item({ id: '2', title: 'Sitcom', lastWatchedAt: '2026-06-10' }),
    ]
    const result = buildShortlist(items, ctx({ episodeCounts: counts }), '30min')
    expect(result.every((e) => e.item.id !== '1')).toBe(true)
  })
})
