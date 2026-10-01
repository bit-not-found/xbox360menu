import { useEffect, useMemo, useState } from 'react'
import Tile from './Tile'

const SLIDE_DURATION = 5000
const TRANSITION_MS = 900
const FALLBACK_ART = './assets/imgs/260x195-PLACEHOLDER.png'
const MAX_DOTS = 10

function gameArt(game) {
  return game.banner || game.icon || FALLBACK_ART
}

function SlideLayer({ game, state }) {
  const src = gameArt(game)
  return (
    <div className={`home-slide home-slide-${state}`}>
      <img
        src={src}
        alt=""
        className="home-slide-img"
        onError={(e) => { if (!e.currentTarget.src.endsWith(FALLBACK_ART)) e.currentTarget.src = FALLBACK_ART }}
      />
    </div>
  )
}

export default function GameSlideshowTile({ games, isActive = true, onSelect }) {
  const slides = useMemo(() => (games || []).filter(g => g && g.name), [games])
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
    preloader.src = gameArt(slides[(index + 1) % slides.length])
  }, [index, slides])

  if (slides.length === 0) return null

  const safeIndex = Math.min(index, slides.length - 1)
  const current = slides[safeIndex]
  const outgoing = outIndex !== null && outIndex !== safeIndex ? slides[outIndex] : null

  return (
    <Tile
      className="home-slide-tile game-tile-banner"
      onClick={() => onSelect && onSelect(current)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {outgoing && <SlideLayer key={`out-${outIndex}`} game={outgoing} state="out" />}
      <SlideLayer key={`in-${safeIndex}`} game={current} state="in" />

      <div className="home-slide-scrim" />
      <div key={`name-${safeIndex}`} className="home-slide-name">{current.name}</div>

      {slides.length > 1 && (
        slides.length <= MAX_DOTS ? (
          <div className="home-slide-dots">
            {slides.map((g, i) => (
              <span key={g.name} className={`home-slide-dot ${i === safeIndex ? 'active' : ''}`} />
            ))}
          </div>
        ) : (
          <div className="home-slide-counter">{safeIndex + 1} / {slides.length}</div>
        )
      )}
    </Tile>
  )
}