import { describe, expect, it } from 'vitest'
import { formatEpisodeLabel } from '../episode-label'

describe('formatEpisodeLabel', () => {
  it('defaults to S01 E01 when both are null/undefined', () => {
    expect(formatEpisodeLabel(null, null)).toBe('S01 E01')
    expect(formatEpisodeLabel(undefined, undefined)).toBe('S01 E01')
  })

  it('never emits episode 0', () => {
    expect(formatEpisodeLabel(1, 0)).toBe('S01 E01')
    expect(formatEpisodeLabel(2, 0)).toBe('S02 E01')
  })

  it('formats a normal episode correctly', () => {
    expect(formatEpisodeLabel(2, 5)).toBe('S02 E05')
    expect(formatEpisodeLabel(10, 12)).toBe('S10 E12')
  })

  it('pads single digits', () => {
    expect(formatEpisodeLabel(1, 1)).toBe('S01 E01')
    expect(formatEpisodeLabel(3, 9)).toBe('S03 E09')
  })

  it('never emits season 0', () => {
    expect(formatEpisodeLabel(0, 5)).toBe('S01 E05')
  })
})
