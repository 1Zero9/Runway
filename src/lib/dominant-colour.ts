import { Vibrant } from 'node-vibrant/node'

export async function extractDominantColour(posterPath: string): Promise<string | null> {
  try {
    const url = `https://image.tmdb.org/t/p/w45${posterPath}`
    const palette = await new Vibrant(url).getPalette()
    const swatch = palette.DarkVibrant ?? palette.Vibrant ?? palette.DarkMuted ?? palette.Muted
    if (!swatch) return null
    const [r, g, b] = swatch.rgb
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
  } catch {
    return null
  }
}
