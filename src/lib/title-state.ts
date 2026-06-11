export type Relationship = 'none' | 'watchlisted' | 'tracking' | 'finished' | 'abandoned'

type TransitionMap = Record<Relationship, Relationship[]>

const LEGAL_TRANSITIONS: TransitionMap = {
  none:        ['watchlisted', 'tracking', 'finished'],
  watchlisted: ['tracking', 'finished', 'none'],
  tracking:    ['finished', 'abandoned', 'watchlisted', 'none'],
  finished:    ['tracking', 'none'],
  abandoned:   ['tracking', 'watchlisted', 'none'],
}

export function isLegalTransition(from: Relationship, to: Relationship): boolean {
  if (from === to) return false
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

export function legalTargets(from: Relationship): Relationship[] {
  return LEGAL_TRANSITIONS[from] ?? []
}

export function statusToRelationship(status?: string | null, done?: boolean): Relationship {
  if (!status) return done ? 'finished' : 'tracking'
  switch (status) {
    case 'planned':   return 'watchlisted'
    case 'watching':
    case 'waiting':   return 'tracking'
    case 'completed': return 'finished'
    case 'dropped':   return 'abandoned'
    default:          return 'tracking'
  }
}

export function relationshipToStatus(rel: Relationship): { status: string; done: boolean } {
  switch (rel) {
    case 'none':        return { status: 'watching', done: false }
    case 'watchlisted': return { status: 'planned',   done: false }
    case 'tracking':    return { status: 'watching',  done: false }
    case 'finished':    return { status: 'completed', done: true }
    case 'abandoned':   return { status: 'dropped',   done: false }
  }
}

export function relationshipLabel(rel: Relationship): string {
  switch (rel) {
    case 'none':        return 'Add'
    case 'watchlisted': return 'On your list'
    case 'tracking':    return 'Tracking'
    case 'finished':    return 'Finished'
    case 'abandoned':   return 'Dropped'
  }
}

export function relationshipActionLabel(rel: Relationship): string {
  switch (rel) {
    case 'none':        return 'Add'
    case 'watchlisted': return 'Watchlist'
    case 'tracking':    return 'Track'
    case 'finished':    return 'Seen it'
    case 'abandoned':   return 'Drop it'
  }
}
