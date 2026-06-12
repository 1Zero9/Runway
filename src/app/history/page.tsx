'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

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

// tap cycle: null → 'liked' → 'loved' → null
type TileState = 'liked' | 'loved' | 'not_for_me' | null

type LoggedMap = Map<number, TileState>

// Items already in the watchlist (from DB) keyed by tmdbId
type LibraryMap = Map<number, { title: string; sentiment: TileState }>

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342'

export default function HistoryWallPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logged, setLogged] = useState<LoggedMap>(new Map())
  const [library, setLibrary] = useState<LibraryMap>(new Map())
  const [sessionCount, setSessionCount] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoStack = useRef<Array<{ id: number; prev: TileState; title: string }>>([])

  // Long-press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTarget = useRef<number | null>(null)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(''), 3000)
  }

  // Load wall sections
  useEffect(() => {
    fetch('/api/media-guide/curated-wall')
      .then((r) => r.json())
      .then((data: { sections?: Section[]; error?: string }) => {
        if (data.error) { setError(data.error); return }
        setSections(data.sections ?? [])
        if (data.sections?.[0]) setActiveSection(data.sections[0].id)
      })
      .catch(() => setError('Failed to load wall'))
      .finally(() => setLoading(false))
  }, [])

  // Load existing library items
  useEffect(() => {
    fetch('/api/media-guide/watchlist')
      .then((r) => r.json())
      .then((items: Array<{ tmdbId?: number | null; title: string; sentiment?: TileState }>) => {
        const map: LibraryMap = new Map()
        for (const item of items) {
          if (item.tmdbId) {
            map.set(item.tmdbId, { title: item.title, sentiment: item.sentiment ?? null })
          }
        }
        setLibrary(map)
      })
      .catch(() => {/* non-fatal */})
  }, [])

  async function persistArchive(item: WallItem, sentiment: TileState) {
    const body = {
      title: item.title,
      type: item.mediaType === 'movie' ? 'film' : 'show',
      tmdbId: item.id,
      posterPath: item.posterPath,
      relationship: 'finished',
      status: 'completed',
      done: true,
      logMode: 'archive',
      lastWatchedAt: new Date().toISOString().slice(0, 10),
      ...(sentiment ? { sentiment } : {}),
    }
    await fetch('/api/media-guide/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const handleTap = useCallback(async (item: WallItem) => {
    const prev = logged.get(item.id) ?? library.get(item.id)?.sentiment ?? null

    // Cycle: null → liked → loved → null
    const next: TileState = prev === null ? 'liked' : prev === 'liked' ? 'loved' : null

    undoStack.current.push({ id: item.id, prev, title: item.title })

    setLogged((m) => {
      const copy = new Map(m)
      if (next === null) copy.delete(item.id)
      else copy.set(item.id, next)
      return copy
    })

    if (next !== null && !library.has(item.id)) {
      setSessionCount((n) => n + 1)
      await persistArchive(item, next)
      setLibrary((m) => new Map(m).set(item.id, { title: item.title, sentiment: next }))
    } else if (next !== null) {
      // Update sentiment only
      const existing = library.get(item.id)
      if (existing) {
        const items = await fetch('/api/media-guide/watchlist').then((r) => r.json()) as Array<{ id: string; tmdbId?: number | null }>
        const match = items.find((i) => i.tmdbId === item.id)
        if (match) {
          await fetch('/api/media-guide/watchlist', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: match.id, sentiment: next }),
          })
          setLibrary((m) => new Map(m).set(item.id, { title: item.title, sentiment: next }))
        }
      }
    }

    const label = next === 'liked' ? 'Seen' : next === 'loved' ? 'Loved' : 'Cleared'
    showToast(`${label}: ${item.title}`)
  }, [logged, library])

  const handleNotForMe = useCallback((item: WallItem) => {
    const prev = logged.get(item.id) ?? library.get(item.id)?.sentiment ?? null
    undoStack.current.push({ id: item.id, prev, title: item.title })

    setLogged((m) => {
      const copy = new Map(m)
      copy.set(item.id, 'not_for_me')
      return copy
    })

    if (!library.has(item.id)) {
      setSessionCount((n) => n + 1)
      void persistArchive(item, 'not_for_me')
      setLibrary((m) => new Map(m).set(item.id, { title: item.title, sentiment: 'not_for_me' }))
    }
    showToast(`Not for me: ${item.title}`)
  }, [logged, library])

  function handleUndo() {
    const last = undoStack.current.pop()
    if (!last) return
    setLogged((m) => {
      const copy = new Map(m)
      if (last.prev === null) copy.delete(last.id)
      else copy.set(last.id, last.prev)
      return copy
    })
    showToast(`Undone: ${last.title}`)
  }

  function onLongPressStart(item: WallItem) {
    longPressTarget.current = item.id
    longPressTimer.current = setTimeout(() => {
      if (longPressTarget.current === item.id) {
        handleNotForMe(item)
      }
    }, 600)
  }

  function onLongPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressTarget.current = null
  }

  const activeItems = sections.find((s) => s.id === activeSection)?.items ?? []
  const totalLogged = sessionCount

  if (loading) return (
    <div className="wall-page">
      <div className="wall-loading">Loading your wall…</div>
    </div>
  )

  if (error) return (
    <div className="wall-page">
      <div className="wall-error">{error}</div>
    </div>
  )

  return (
    <div className="wall-page">
      {/* Header */}
      <header className="wall-header">
        <Link href="/" className="wall-back-link">← Runway</Link>
        <div className="wall-header-center">
          <h1 className="wall-title">Build your history</h1>
          <p className="wall-subtitle">Tap once to mark Seen · tap again for Loved · long-press for Not for me</p>
        </div>
        <div className="wall-header-actions">
          {undoStack.current.length > 0 && (
            <button className="wall-undo-btn" onClick={handleUndo}>Undo</button>
          )}
        </div>
      </header>

      {/* Section tabs */}
      <nav className="wall-section-tabs" aria-label="Wall sections">
        {sections.map((s) => (
          <button
            key={s.id}
            className={s.id === activeSection ? 'wall-section-tab active' : 'wall-section-tab'}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Poster grid */}
      <main className="wall-grid-area">
        <div className="wall-grid">
          {activeItems.map((item) => {
            const state = logged.get(item.id) ?? library.get(item.id)?.sentiment ?? null
            const inLibrary = library.has(item.id)
            return (
              <WallTile
                key={item.id}
                item={item}
                state={state}
                inLibrary={inLibrary}
                onTap={handleTap}
                onLongPressStart={onLongPressStart}
                onLongPressEnd={onLongPressEnd}
              />
            )
          })}
        </div>
      </main>

      {/* Momentum bar */}
      <div className="wall-momentum-bar">
        <div className="wall-momentum-inner">
          <span className="wall-momentum-count">
            {totalLogged > 0 ? `${totalLogged} logged this session` : 'Tap a poster to start logging'}
          </span>
          {totalLogged >= 5 && (
            <span className="wall-momentum-cheer">
              {totalLogged >= 20 ? '🔥 On fire!' : totalLogged >= 10 ? 'Keep going!' : 'Nice start!'}
            </span>
          )}
          <div
            className="wall-momentum-fill"
            style={{ width: `${Math.min(100, (totalLogged / 30) * 100)}%` }}
          />
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="wall-toast" role="status">
          {toastMsg}
          {undoStack.current.length > 0 && (
            <button className="wall-toast-undo" onClick={handleUndo}>Undo</button>
          )}
        </div>
      )}
    </div>
  )
}

function WallTile({
  item,
  state,
  inLibrary,
  onTap,
  onLongPressStart,
  onLongPressEnd,
}: {
  item: WallItem
  state: TileState
  inLibrary: boolean
  onTap: (item: WallItem) => void
  onLongPressStart: (item: WallItem) => void
  onLongPressEnd: () => void
}) {
  const isDimmed = inLibrary && state === null
  const overlayGlyph = state === 'liked' ? '✓' : state === 'loved' ? '♥' : state === 'not_for_me' ? '✕' : null

  return (
    <button
      className={[
        'wall-tile',
        state ? `wall-tile-${state}` : '',
        isDimmed ? 'wall-tile-dimmed' : '',
      ].filter(Boolean).join(' ')}
      type="button"
      title={`${item.title}${item.year ? ` (${item.year})` : ''}`}
      onClick={() => onTap(item)}
      onContextMenu={(e) => { e.preventDefault(); onLongPressStart(item); onLongPressEnd() }}
      onMouseDown={() => onLongPressStart(item)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
      onTouchStart={() => onLongPressStart(item)}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
    >
      <div className="wall-tile-poster">
        {item.posterPath ? (
          <Image
            src={`${POSTER_BASE}${item.posterPath}`}
            alt={item.title}
            width={100}
            height={150}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 4 }}
            unoptimized
          />
        ) : (
          <div className="wall-tile-placeholder">{item.title.slice(0, 2)}</div>
        )}
        {overlayGlyph && (
          <div className={`wall-tile-overlay wall-overlay-${state}`}>
            <span className="wall-tile-glyph">{overlayGlyph}</span>
          </div>
        )}
      </div>
    </button>
  )
}
