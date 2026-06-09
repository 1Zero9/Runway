import { notFound } from 'next/navigation'
import { ensureRecommendationTables, getMediaGuideSql } from '@/lib/media-guide-db'
import '../../runway.css'

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
    select title, service, poster_path, overview, note
    from media_recommendation_items
    where list_id = ${list.id}
    order by created_at desc
  `) as { title: string; service: string | null; poster_path: string | null; overview: string | null; note: string | null }[]

  return (
    <main className="shared-list-page">
      <section className="shared-list-hero">
        <p className="eyebrow">Shared recommendations</p>
        <h1>{list.name}</h1>
        <p>{items.length} picks from Runway</p>
      </section>
      <section className="shared-list-grid">
        {items.map((item) => (
          <article className="shared-list-card" key={`${item.title}-${item.service}`}>
            {item.poster_path ? (
              <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt="" />
            ) : (
              <div className="poster-fallback large" />
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
