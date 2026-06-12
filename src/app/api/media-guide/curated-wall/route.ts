import { NextResponse } from 'next/server'
import { hasMediaGuideSession } from '@/lib/media-guide-auth'

export const dynamic = 'force-dynamic'

// TMDB genre IDs
// TV: Crime=80, Drama=18, Sci-Fi & Fantasy=10765, Comedy=35, Action & Adventure=10759, Mystery=9648
// Movie: Crime=80, Drama=18, Science Fiction=878, Comedy=35, Thriller=53

type TmdbItem = {
  id: number
  title?: string
  name?: string
  media_type: 'movie' | 'tv'
  overview: string
  poster_path: string | null
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  release_date?: string
  first_air_date?: string
}

type WallItem = {
  id: number
  title: string
  mediaType: 'movie' | 'tv'
  posterPath: string | null
  voteAverage: number
  year: number | null
  genreIds: number[]
}

type Section = {
  id: string
  label: string
  items: WallItem[]
}

const SECTION_QUERIES: Record<string, { url: string; mediaType: 'tv' | 'movie' }> = {
  tv_90s: {
    url: 'discover/tv?sort_by=vote_average.desc&vote_count.gte=200&first_air_date.gte=1990-01-01&first_air_date.lte=1999-12-31&language=en-US&with_original_language=en',
    mediaType: 'tv',
  },
  tv_00s: {
    url: 'discover/tv?sort_by=vote_average.desc&vote_count.gte=200&first_air_date.gte=2000-01-01&first_air_date.lte=2009-12-31&language=en-US&with_original_language=en',
    mediaType: 'tv',
  },
  tv_10s: {
    url: 'discover/tv?sort_by=vote_average.desc&vote_count.gte=300&first_air_date.gte=2010-01-01&first_air_date.lte=2019-12-31&language=en-US&with_original_language=en',
    mediaType: 'tv',
  },
  crime_drama: {
    url: 'discover/tv?sort_by=vote_average.desc&vote_count.gte=200&with_genres=80%7C18&language=en-US&with_original_language=en',
    mediaType: 'tv',
  },
  sci_fi: {
    url: 'discover/tv?sort_by=vote_average.desc&vote_count.gte=200&with_genres=10765&language=en-US&with_original_language=en',
    mediaType: 'tv',
  },
  comedy: {
    url: 'discover/tv?sort_by=vote_average.desc&vote_count.gte=200&with_genres=35&language=en-US&with_original_language=en',
    mediaType: 'tv',
  },
  films_classics: {
    url: 'discover/movie?sort_by=vote_average.desc&vote_count.gte=1000&primary_release_date.gte=1990-01-01&primary_release_date.lte=2019-12-31&language=en-US&with_original_language=en',
    mediaType: 'movie',
  },
}

const SECTION_LABELS: Record<string, string> = {
  tv_90s: '90s TV',
  tv_00s: '00s TV',
  tv_10s: '10s TV',
  crime_drama: 'Crime & Drama',
  sci_fi: 'Sci-Fi & Fantasy',
  comedy: 'Comedy',
  films_classics: 'Film Classics',
}

function mapItem(raw: TmdbItem, mediaType: 'tv' | 'movie'): WallItem {
  const title = raw.name ?? raw.title ?? ''
  const dateStr = raw.first_air_date ?? raw.release_date ?? ''
  const year = dateStr ? parseInt(dateStr.slice(0, 4)) : null
  return {
    id: raw.id,
    title,
    mediaType,
    posterPath: raw.poster_path,
    voteAverage: raw.vote_average,
    year,
    genreIds: raw.genre_ids ?? [],
  }
}

async function fetchSection(
  apiKey: string,
  sectionId: string,
  page = 1,
): Promise<WallItem[]> {
  const query = SECTION_QUERIES[sectionId]
  if (!query) return []

  const url = `https://api.themoviedb.org/3/${query.url}&api_key=${apiKey}&page=${page}`
  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) return []

  const data = (await res.json()) as { results: TmdbItem[] }
  return data.results
    .filter((item) => item.poster_path)
    .slice(0, 24)
    .map((item) => mapItem(item, query.mediaType))
}

export async function GET(request: Request) {
  if (!(await hasMediaGuideSession())) {
    return NextResponse.json({ error: 'Runway login required.' }, { status: 401 })
  }

  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const sectionParam = searchParams.get('section')

  if (sectionParam) {
    // Fetch a single section (used for "Show more" / lazy load)
    const page = parseInt(searchParams.get('page') ?? '1')
    const items = await fetchSection(apiKey, sectionParam, page)
    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, max-age=86400' } },
    )
  }

  // Fetch all sections in parallel for initial load
  const sectionIds = Object.keys(SECTION_QUERIES)
  const results = await Promise.all(
    sectionIds.map((id) => fetchSection(apiKey, id).then((items) => ({ id, items }))),
  )

  const sections: Section[] = results.map(({ id, items }) => ({
    id,
    label: SECTION_LABELS[id] ?? id,
    items,
  }))

  return NextResponse.json(
    { sections },
    { headers: { 'Cache-Control': 'private, max-age=3600' } },
  )
}
