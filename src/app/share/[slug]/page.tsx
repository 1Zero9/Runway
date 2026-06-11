import { notFound } from 'next/navigation'
import Image from 'next/image'
import { ensureRecommendationTables, getMediaGuideSql } from '@/lib/media-guide-db'
import '../../runway.css'

function makePosterBlur(colour: string | null | undefined): string {
  const bg = colour ?? '#EEF0F3'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15"><rect width="10" height="15" fill="${bg}"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

type Provider = { provider_name: string; logo_path: string }

async function fetchWatchProviders(
  tmdbId: number | null,
  mediaType: string,
): Promise<Provider[]> {
  const apiKey = process.env.TMDB_API_KEY?.trim()
  if (!apiKey || !tmdbId) return []
  const type = mediaType === 'tv' ? 'tv' : 'movie'
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/watch/providers?api_key=${apiKey}`,
      { next: { revalidate: 86400 } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { results?: { IE?: { flatrate?: Provider[] } } }
    return data.results?.IE?.flatrate?.slice(0, 3) ?? []
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'

type SharePageProps = {
  params: Promise<{ slug: string }>
}

type ListItem = {
  title: string
  service: string | null
  poster_path: string | null
  overview: string | null
  note: string | null
  dominant_colour: string | null
  tmdb_id: number | null
  media_type: string | null
}

export default async function SharedRecommendationListPage({ params }: SharePageProps) {
  const { slug } = await params
  const sql = getMediaGuideSql()
  await ensureRecommendationTables(sql)

  const lists = await sql`
    select id, name
    from media_recommendation_lists
    where share_slug = ${slug}
    limit 1
  `

  const list = lists[0] as { id: string; name: string } | undefined
  if (!list) notFound()

  const items = (await sql`
    select title, service, poster_path, overview, note, dominant_colour, tmdb_id, media_type
    from media_recommendation_items
    where list_id = ${list.id}
    order by created_at desc
  `) as ListItem[]

  const collagePosters = items.filter((i) => i.poster_path).slice(0, 5)

  // Fetch where-to-watch for each item in parallel (cap at 12)
  const providersPerItem = await Promise.all(
    items.slice(0, 12).map((item) => fetchWatchProviders(item.tmdb_id, item.media_type ?? 'movie')),
  )

  return (
    <main className="shared-list-page">
      <div className="shared-list-content">
        {/* Collage header */}
        <div className="share-collage">
          {collagePosters.length > 0 && (
            <div className="share-collage-posters">
              {collagePosters.map((item) => (
                <Image
                  key={item.poster_path}
                  src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                  alt=""
                  width={200}
                  height={300}
                  sizes="160px"
                  style={{ width: 'auto', height: '100%', objectFit: 'cover', display: 'block' }}
                  placeholder="blur"
                  blurDataURL={makePosterBlur(item.dominant_colour)}
                />
              ))}
            </div>
          )}
          <div className="share-collage-overlay" />
          <div className="share-collage-text">
            <p className="eyebrow">Shared recommendations</p>
            <h1>{list.name}</h1>
            <p className="share-collage-count">{items.length} picks from Runway</p>
          </div>
        </div>

        {/* Card grid */}
        <section className="shared-list-grid">
          {items.map((item, index) => {
            const providers = providersPerItem[index] ?? []
            return (
              <article
                className="shared-list-card"
                key={`${item.title}-${item.service}`}
                style={item.dominant_colour ? { borderColor: `${item.dominant_colour}40` } : undefined}
              >
                {item.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                    alt=""
                    width={342}
                    height={513}
                    sizes="(max-width: 720px) 32vw, (max-width: 980px) 22vw, 320px"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    placeholder="blur"
                    blurDataURL={makePosterBlur(item.dominant_colour)}
                  />
                ) : (
                  <div className="poster-fallback large">
                    <span className="poster-fallback-title">{item.title}</span>
                  </div>
                )}
                <div>
                  <span>{item.service || 'Recommended'}</span>
                  <h2>{item.title}</h2>
                  {item.note && <strong>{item.note}</strong>}
                  <p>{item.overview || 'No summary available.'}</p>
                  {providers.length > 0 && (
                    <div className="share-providers">
                      {providers.map((p) => (
                        <span key={p.provider_name} className="share-provider-badge">
                          <Image
                            src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                            alt={p.provider_name}
                            width={16}
                            height={16}
                            style={{ width: 16, height: 16, borderRadius: 3, display: 'block' }}
                          />
                          {p.provider_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        <footer className="share-footer">
          <span className="topbar-wordmark">Runway</span>
          <p>Your guide to Irish TV &amp; streaming</p>
        </footer>
      </div>
    </main>
  )
}
