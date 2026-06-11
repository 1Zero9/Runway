import { describe, expect, it } from 'vitest'
import { deriveNextEpisode, deriveMinutesRemaining } from '../next-episode'
import type { EpisodeRecord } from '../next-episode'

function ep(overrides: Partial<EpisodeRecord> & { id: string; season: number; episode: number }): EpisodeRecord {
  return { title: null, runtime: null, air_date: null, ...overrides }
}

const SHOW: EpisodeRecord[] = [
  ep({ id: 's0e1', season: 0, episode: 1 }),  // special — must be excluded
  ep({ id: 's1e1', season: 1, episode: 1, runtime: 45 }),
  ep({ id: 's1e2', season: 1, episode: 2, runtime: 44 }),
  ep({ id: 's1e3', season: 1, episode: 3, runtime: 43 }),
  ep({ id: 's2e1', season: 2, episode: 1, runtime: 50 }),
  ep({ id: 's2e2', season: 2, episode: 2, runtime: 51 }),
]

describe('deriveNextEpisode', () => {
  it('returns S01E01 when nothing is watched', () => {
    const next = deriveNextEpisode(SHOW, new Set())
    expect(next?.id).toBe('s1e1')
  })

  it('returns null when all regular episodes are watched', () => {
    const all = new Set(SHOW.filter((e) => e.season > 0).map((e) => e.id))
    expect(deriveNextEpisode(SHOW, all)).toBeNull()
  })

  it('never returns a season-0 special as next episode', () => {
    // Only the special is "unwatched"; all regular eps watched
    const watched = new Set(SHOW.filter((e) => e.season > 0).map((e) => e.id))
    const next = deriveNextEpisode(SHOW, watched)
    expect(next).toBeNull()
  })

  it('skips over watched episodes correctly', () => {
    const watched = new Set(['s1e1', 's1e2'])
    const next = deriveNextEpisode(SHOW, watched)
    expect(next?.id).toBe('s1e3')
  })

  it('advances to the next season when the current one is finished', () => {
    const watched = new Set(['s1e1', 's1e2', 's1e3'])
    const next = deriveNextEpisode(SHOW, watched)
    expect(next?.id).toBe('s2e1')
    expect(next?.season).toBe(2)
    expect(next?.episode).toBe(1)
  })

  it('handles out-of-order episode list input', () => {
    const shuffled = [...SHOW].reverse()
    const watched = new Set(['s1e1'])
    const next = deriveNextEpisode(shuffled, watched)
    expect(next?.id).toBe('s1e2')
  })

  it('returns null for empty episode list', () => {
    expect(deriveNextEpisode([], new Set())).toBeNull()
  })
})

describe('deriveMinutesRemaining', () => {
  it('sums runtime for all unwatched regular episodes', () => {
    const watched = new Set(['s1e1'])
    // s1e2(44) + s1e3(43) + s2e1(50) + s2e2(51) = 188
    expect(deriveMinutesRemaining(SHOW, watched)).toBe(188)
  })

  it('returns 0 when all watched', () => {
    const all = new Set(SHOW.filter((e) => e.season > 0).map((e) => e.id))
    expect(deriveMinutesRemaining(SHOW, all)).toBe(0)
  })

  it('excludes specials (season 0) from the total', () => {
    // Unwatch everything — specials should not count
    const total = deriveMinutesRemaining(SHOW, new Set())
    // s1e1(45) + s1e2(44) + s1e3(43) + s2e1(50) + s2e2(51) = 233; s0e1 has null runtime so 0
    expect(total).toBe(233)
  })

  it('skips episodes with null runtime gracefully', () => {
    const withNullRuntime = [ep({ id: 'x', season: 1, episode: 1, runtime: null })]
    expect(deriveMinutesRemaining(withNullRuntime, new Set())).toBe(0)
  })
})
