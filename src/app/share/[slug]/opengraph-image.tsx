import { ImageResponse } from 'next/og'
import { ensureRecommendationTables, getMediaGuideSql } from '@/lib/media-guide-db'

export const runtime = 'nodejs'
export const contentType = 'image/png'
export const size = { width: 1200, height: 630 }

type OgPageProps = {
  params: Promise<{ slug: string }>
}

export default async function OgImage({ params }: OgPageProps) {
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
  if (!list) {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#F6F7F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'serif',
          color: '#16181D',
        }}
      >
        Runway
      </div>,
      size,
    )
  }

  const items = (await sql`
    select title, poster_path, dominant_colour
    from media_recommendation_items
    where list_id = ${list.id}
    order by created_at desc
    limit 4
  `) as { title: string; poster_path: string | null; dominant_colour: string | null }[]

  const posters = items.filter((i) => i.poster_path).slice(0, 3)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(145deg, #FFFFFF 0%, #F6F7F9 100%)',
        display: 'flex',
        alignItems: 'center',
        padding: '60px',
        gap: '60px',
        position: 'relative',
      }}
    >
      {/* Poster fan */}
      {posters.length > 0 && (
        <div style={{ display: 'flex', position: 'relative', flexShrink: 0, width: 320, height: 420 }}>
          {posters.map((item, i) => {
            const rotations = [-10, 0, 10]
            const offsets = [-24, 0, 24]
            return (
              <img
                key={item.poster_path}
                src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                style={{
                  position: 'absolute',
                  left: `${100 + offsets[i] * 3}px`,
                  top: `${Math.abs(offsets[i]) * 0.8}px`,
                  width: 180,
                  height: 270,
                  objectFit: 'cover',
                  borderRadius: 14,
                  border: '2px solid rgba(194,54,43,0.18)',
                  transform: `rotate(${rotations[i]}deg)`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Text content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#6B7280',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Shared recommendations
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 750,
            color: '#16181D',
            lineHeight: 1.15,
            wordBreak: 'break-word',
          }}
        >
          {list.name}
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#6B7280',
          }}
        >
          {items.length} picks
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            fontWeight: 750,
            color: '#C2362B',
          }}
        >
          Runway
        </div>
      </div>
    </div>,
    size,
  )
}
