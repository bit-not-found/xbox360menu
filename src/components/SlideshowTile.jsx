import { useEffect, useMemo, useState } from 'react'
import Tile from './Tile'
import { PLACEHOLDER_ART } from '../utils/artwork'

const SLIDE_DURATION = 5000
const TRANSITION_MS = 900
const MAX_DOTS = 10

function defaultArtOf(item) {
  return item.banner || item.icon || PLACEHOLDER_ART
}

function SlideLayer({ item, state, artOf }) {
  const src = artOf(item) || PLACEHOLDER_ART
  if (item.kind === 'video') {
    return (
      <div className={`home-slide home-slide-${state}`}>
        <video src={src} muted preload="metadata" className="home-slide-img" />
      </div>
    )
  }
  return (
    <div className={`home-slide home-slide-${state}`}>
      <img
        src={src}
        alt=""
        className="home-slide-img"
        onError={(e) => { if (!e.currentTarget.src.endsWith(PLACEHOLDER_ART)) e.currentTarget.src = PLACEHOLDER_ART }}
      />
    </div>
  )
}

export default function SlideshowTile({
  items,
  isActive = true,
  onSelect,
  onContextMenu,
  artOf = defaultArtOf,
  keyOf = (item) => item.name,
  showName = true,
}) {
  const slides = useMemo(() => (items || []).filter(it => it && (it.name || it.id)), [items])
  const [index, setIndex] = useState(0)
  const [outIndex, setOutIndex] = useState(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (outIndex === null) return
    const timer = setTimeout(() => setOutIndex(null), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [outIndex])

  useEffect(() => {
    if (hovered || !isActive || slides.length < 2) return
    const timer = setTimeout(() => {
      setOutIndex(index)
      setIndex(i => (i + 1) % slides.length)
    }, SLIDE_DURATION)
    return () => clearTimeout(timer)
  }, [index, hovered, isActive, slides.length])

  useEffect(() => {
    if (slides.length < 2) return
    const preloader = new Image()
    preloader.src = artOf(slides[(index + 1) % slides.length])
  }, [index, slides, artOf])

  if (slides.length === 0) return null

  const safeIndex = Math.min(index, slides.length - 1)
  const current = slides[safeIndex]
  const outgoing = outIndex !== null && outIndex !== safeIndex ? slides[outIndex] : null

  return (
    <Tile
      className="home-slide-tile game-tile-banner"
      onClick={() => onSelect && onSelect(current)}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {outgoing && <SlideLayer key={`out-${keyOf(outgoing)}`} item={outgoing} state="out" artOf={artOf} />}
      <SlideLayer key={`in-${keyOf(current)}`} item={current} state="in" artOf={artOf} />

      <div className="home-slide-scrim" />
      {showName && <div key={`name-${keyOf(current)}`} className="home-slide-name">{current.name}</div>}

      {slides.length > 1 && (
        slides.length <= MAX_DOTS ? (
          <div className="home-slide-dots">
            {slides.map((it, i) => (
              <span key={keyOf(it)} className={`home-slide-dot ${i === safeIndex ? 'active' : ''}`} />
            ))}
          </div>
        ) : (
          <div className="home-slide-counter">{safeIndex + 1} / {slides.length}</div>
        )
      )}
    </Tile>
  )
}
