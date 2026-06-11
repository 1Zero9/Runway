export type EpisodeRecord = {
  id: string
  season: number
  episode: number
  title: string | null
  runtime: number | null
  air_date: string | null
}

/**
 * Derive the next unwatched episode from a flat list.
 * Season 0 (specials) is always excluded — they never count as progress.
 * Returns null when all regular episodes are watched or there are none.
 */
export function deriveNextEpisode(
  episodes: EpisodeRecord[],
  watchedIds: Set<string>,
): EpisodeRecord | null {
  return (
    episodes
      .filter((e) => e.season > 0)
      .sort((a, b) => (a.season !== b.season ? a.season - b.season : a.episode - b.episode))
      .find((e) => !watchedIds.has(e.id)) ?? null
  )
}

/** Compute minutes remaining (unwatched episodes with known runtime). */
export function deriveMinutesRemaining(
  episodes: EpisodeRecord[],
  watchedIds: Set<string>,
): number {
  return episodes
    .filter((e) => e.season > 0 && !watchedIds.has(e.id) && e.runtime != null)
    .reduce((sum, e) => sum + (e.runtime ?? 0), 0)
}
