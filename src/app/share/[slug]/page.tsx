import { notFound } from 'next/navigation'
import Image from 'next/image'
import { ensureRecommendationTables, getMediaGuideSql } from '@/lib/media-guide-db'
import '../../runway.css'

function makePosterBlur(colour: string | null | undefined): string {
  const bg = colour ?? '#14171C'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15"><rect width="10" height="15" fill="${bg}"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export const dynamic = 'force-dynamic'

type SharePageProps = {
  params: Promise<{ slug: string }>
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
    select title, service, poster_path, overview, note, dominant_colour
    from media_recommendation_items
    where list_id = ${list.id}
    order by created_at desc
  `) as { title: string; service: string | null; poster_path: string | null; overview: string | null; note: string | null; dominant_colour: string | null }[]

  return (
    <main className="shared-list-page">
      <section className="shared-list-hero">
        <p className="eyebrow">Shared recommendations</p>
        <h1>{list.name}</h1>
        <p>{items.length} picks from Runway</p>
      </section>
      <section className="shared-list-grid">
        {items.map((item) => (
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
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
