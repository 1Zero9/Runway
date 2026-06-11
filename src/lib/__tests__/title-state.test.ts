import { describe, it, expect } from 'vitest'
import {
  isLegalTransition,
  legalTargets,
  statusToRelationship,
  relationshipToStatus,
} from '../title-state'
import type { Relationship } from '../title-state'

// ── isLegalTransition ─────────────────────────────────────────────────────────

describe('isLegalTransition — legal paths', () => {
  it('none → watchlisted', () => expect(isLegalTransition('none', 'watchlisted')).toBe(true))
  it('none → tracking', () => expect(isLegalTransition('none', 'tracking')).toBe(true))
  it('none → finished', () => expect(isLegalTransition('none', 'finished')).toBe(true))

  it('watchlisted → tracking (start watching)', () => expect(isLegalTransition('watchlisted', 'tracking')).toBe(true))
  it('watchlisted → finished (seen it from list)', () => expect(isLegalTransition('watchlisted', 'finished')).toBe(true))
  it('watchlisted → none (remove)', () => expect(isLegalTransition('watchlisted', 'none')).toBe(true))

  it('tracking → finished', () => expect(isLegalTransition('tracking', 'finished')).toBe(true))
  it('tracking → abandoned (drop it)', () => expect(isLegalTransition('tracking', 'abandoned')).toBe(true))
  it('tracking → watchlisted', () => expect(isLegalTransition('tracking', 'watchlisted')).toBe(true))
  it('tracking → none (remove)', () => expect(isLegalTransition('tracking', 'none')).toBe(true))

  it('finished → tracking (new season / rewatch)', () => expect(isLegalTransition('finished', 'tracking')).toBe(true))
  it('finished → none (remove)', () => expect(isLegalTransition('finished', 'none')).toBe(true))

  it('abandoned → tracking (pick back up)', () => expect(isLegalTransition('abandoned', 'tracking')).toBe(true))
  it('abandoned → watchlisted', () => expect(isLegalTransition('abandoned', 'watchlisted')).toBe(true))
  it('abandoned → none (remove)', () => expect(isLegalTransition('abandoned', 'none')).toBe(true))
})

describe('isLegalTransition — illegal paths', () => {
  const states: Relationship[] = ['none', 'watchlisted', 'tracking', 'finished', 'abandoned']
  for (const state of states) {
    it(`${state} → ${state} (same is illegal)`, () => expect(isLegalTransition(state, state)).toBe(false))
  }

  it('finished → watchlisted (must go via tracking)', () => expect(isLegalTransition('finished', 'watchlisted')).toBe(false))
  it('finished → abandoned (must go via tracking)', () => expect(isLegalTransition('finished', 'abandoned')).toBe(false))
  it('abandoned → finished (must go via tracking)', () => expect(isLegalTransition('abandoned', 'finished')).toBe(false))
  it('watchlisted → abandoned (must go via tracking)', () => expect(isLegalTransition('watchlisted', 'abandoned')).toBe(false))
})

// ── legalTargets ──────────────────────────────────────────────────────────────

describe('legalTargets', () => {
  it('none has 3 targets', () => expect(legalTargets('none')).toHaveLength(3))
  it('tracking has 4 targets', () => expect(legalTargets('tracking')).toHaveLength(4))
  it('finished has 2 targets', () => expect(legalTargets('finished')).toHaveLength(2))
  it('abandoned has 3 targets', () => expect(legalTargets('abandoned')).toHaveLength(3))
  it('abandoned targets include tracking', () => expect(legalTargets('abandoned')).toContain('tracking'))
  it('tracking targets include finished and abandoned', () => {
    const targets = legalTargets('tracking')
    expect(targets).toContain('finished')
    expect(targets).toContain('abandoned')
  })
})

// ── statusToRelationship ──────────────────────────────────────────────────────

describe('statusToRelationship', () => {
  it('maps watching → tracking', () => expect(statusToRelationship('watching')).toBe('tracking'))
  it('maps waiting → tracking', () => expect(statusToRelationship('waiting')).toBe('tracking'))
  it('maps planned → watchlisted', () => expect(statusToRelationship('planned')).toBe('watchlisted'))
  it('maps completed → finished', () => expect(statusToRelationship('completed')).toBe('finished'))
  it('maps dropped → abandoned', () => expect(statusToRelationship('dropped')).toBe('abandoned'))
  it('falls back to tracking for unknown status', () => expect(statusToRelationship('unknown')).toBe('tracking'))
  it('falls back to finished when done=true and no status', () => expect(statusToRelationship(null, true)).toBe('finished'))
  it('falls back to tracking when done=false and no status', () => expect(statusToRelationship(null, false)).toBe('tracking'))
})

// ── relationshipToStatus ──────────────────────────────────────────────────────

describe('relationshipToStatus', () => {
  it('watchlisted → planned, not done', () => {
    const { status, done } = relationshipToStatus('watchlisted')
    expect(status).toBe('planned')
    expect(done).toBe(false)
  })
  it('tracking → watching, not done', () => {
    const { status, done } = relationshipToStatus('tracking')
    expect(status).toBe('watching')
    expect(done).toBe(false)
  })
  it('finished → completed, done', () => {
    const { status, done } = relationshipToStatus('finished')
    expect(status).toBe('completed')
    expect(done).toBe(true)
  })
  it('abandoned → dropped, not done', () => {
    const { status, done } = relationshipToStatus('abandoned')
    expect(status).toBe('dropped')
    expect(done).toBe(false)
  })
  it('none → watching (reset state)', () => {
    const { status, done } = relationshipToStatus('none')
    expect(status).toBe('watching')
    expect(done).toBe(false)
  })
})

// ── round-trips ───────────────────────────────────────────────────────────────

describe('round-trip: statusToRelationship → relationshipToStatus', () => {
  const pairs: Array<[string, boolean, Relationship]> = [
    ['planned',   false, 'watchlisted'],
    ['watching',  false, 'tracking'],
    ['completed', true,  'finished'],
    ['dropped',   false, 'abandoned'],
  ]
  for (const [status, done, expectedRel] of pairs) {
    it(`status=${status} → ${expectedRel} → maps back cleanly`, () => {
      const rel = statusToRelationship(status, done)
      expect(rel).toBe(expectedRel)
      const back = relationshipToStatus(rel)
      expect(back.done).toBe(done)
    })
  }
})
