export function formatEpisodeLabel(season: number | null | undefined, episode: number | null | undefined): string {
  const s = Math.max(1, season ?? 1)
  const e = Math.max(1, episode ?? 1)
  return `S${String(s).padStart(2, '0')} E${String(e).padStart(2, '0')}`
}
