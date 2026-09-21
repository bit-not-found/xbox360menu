import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMusic } from '../context/MusicContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const playHover = () => { hoverAudio.currentTime = 0; hoverAudio.play().catch(() => {}) }
const playSelect = () => { selectAudio.currentTime = 0; selectAudio.play().catch(() => {}) }
const playBack = () => { backAudio.currentTime = 0; backAudio.play().catch(() => {}) }

const NAV_ITEMS = [
  { id: 'songs', label: 'Songs', icon: '♪' },
  { id: 'artists', label: 'Artists', icon: '👤' },
  { id: 'albums', label: 'Albums', icon: '💿' },
  { id: 'genres', label: 'Genres', icon: '🎵' },
  { id: 'playlists', label: 'Playlists', icon: '📋' },
  { id: 'smartMixes', label: 'Smart Mixes', icon: '✨' },
  { id: 'recentlyAdded', label: 'Recently Added', icon: '🕐' },
  { id: 'favorites', label: 'Favorites', icon: '❤' },
]

const VIZ_MODES = [
  { id: 'bars', label: 'Frequency Bars' },
  { id: 'circular', label: 'Circular' },
  { id: 'waveform', label: 'Waveform' },
]

export default function FullscreenPlayer({ onClose, isActive, onNavigate, customMusicCovers = {} }) {
  const [isClosing, setIsClosing] = useState(false)
  const [vizMode, setVizMode] = useState('bars')
  const [showSettings, setShowSettings] = useState(false)
  const [activeNav, setActiveNav] = useState('songs')

  const canvasRef = useRef(null)
  const animRef = useRef(null)

  const {
    currentTrack, isPlaying,
    currentTime, duration, volume, isMuted,
    formatTime, togglePlay, next, prev, seek,
    setVolume, toggleMute,
    getAudioContext, getAnalyser, connectAudioSource,
  } = useMusic()

  const getCoverUrl = (track) => {
    if (!track) return ''
    return customMusicCovers[track.path] || track.cover || ''
  }

  const trackName = currentTrack?.name || 'No music playing'
  const trackCover = currentTrack ? getCoverUrl(currentTrack) : ''
  const trackArtist = currentTrack?.artist || ''

  useEffect(() => {
    if (!isActive) {
      setIsClosing(true)
      const t = setTimeout(() => onClose(), 300)
      return () => clearTimeout(t)
    }
  }, [isActive, onClose])

  useEffect(() => {
    const handleGuideOpened = () => {
      if (!isClosing) handleClose()
    }
    window.addEventListener('guide-opened', handleGuideOpened)
    return () => window.removeEventListener('guide-opened', handleGuideOpened)
  }, [isClosing])

  const handleClose = useCallback(() => {
    playBack()
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }, [onClose])

  const handleNavClick = useCallback((id) => {
    playSelect()
    setActiveNav(id)
    if (onNavigate) onNavigate(id)
  }, [onNavigate])

  // Visualizer rendering
  useEffect(() => {
    if (!canvasRef.current) return

    connectAudioSource()
    const analyser = getAnalyser()
    if (!analyser) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let w, h

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const bufferLength = analyser.frequencyBinCount
    const freqData = new Uint8Array(bufferLength)
    const timeData = new Uint8Array(bufferLength)

    const drawBars = () => {
      ctx.clearRect(0, 0, w, h)
      analyser.getByteFrequencyData(freqData)

      const barCount = 80
      const gap = 3
      const barWidth = (w - gap * (barCount - 1)) / barCount
      const step = Math.floor(bufferLength / barCount)

      for (let i = 0; i < barCount; i++) {
        const value = freqData[i * step]
        const barHeight = (value / 255) * h * 0.8
        const x = i * (barWidth + gap)
        const y = h - barHeight

        const hue = 140 + (i / barCount) * 80
        const sat = 60 + (value / 255) * 30
        const light = 30 + (value / 255) * 30

        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.9)`
        ctx.fillRect(x, y, barWidth, barHeight)

        ctx.fillStyle = `hsla(${hue}, ${sat + 10}%, ${light + 15}%, 0.5)`
        ctx.fillRect(x, y - 3, barWidth, 3)
      }
    }

    const drawCircular = () => {
      ctx.clearRect(0, 0, w, h)
      analyser.getByteFrequencyData(freqData)

      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) * 0.25
      const barCount = 120
      const step = Math.floor(bufferLength / barCount)

      for (let i = 0; i < barCount; i++) {
        const value = freqData[i * step]
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
        const barLen = (value / 255) * radius * 1.2

        const x1 = cx + Math.cos(angle) * radius
        const y1 = cy + Math.sin(angle) * radius
        const x2 = cx + Math.cos(angle) * (radius + barLen)
        const y2 = cy + Math.sin(angle) * (radius + barLen)

        const hue = 140 + (i / barCount) * 80
        const light = 35 + (value / 255) * 25

        ctx.strokeStyle = `hsla(${hue}, 70%, ${light}%, 0.85)`
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()
    }

    const drawWaveform = () => {
      ctx.clearRect(0, 0, w, h)
      analyser.getByteTimeDomainData(timeData)

      ctx.lineWidth = 2.5
      ctx.strokeStyle = 'rgba(80, 200, 120, 0.9)'
      ctx.beginPath()

      const sliceWidth = w / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0
        const y = (v * h) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.lineTo(w, h / 2)
      ctx.stroke()

      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(80, 200, 120, 0.15)'
      ctx.beginPath()
      x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(w, h / 2)
      ctx.stroke()
    }

    const render = () => {
      animRef.current = requestAnimationFrame(render)
      if (vizMode === 'bars') drawBars()
      else if (vizMode === 'circular') drawCircular()
      else drawWaveform()
    }

    render()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
      ro.disconnect()
    }
  }, [vizMode, getAudioContext, getAnalyser, connectAudioSource])

  const content = (
    <div className={`fs-player ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="fs-player-container" onClick={e => e.stopPropagation()}>

        {/* Visualizer canvas - full background */}
        <div className="fs-viz-wrap">
          <canvas ref={canvasRef} className="fs-viz-canvas" />
        </div>

        {/* Cover art background blur */}
        {trackCover && (
          <div
            className="fs-cover-bg"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url("${trackCover}")`,
            }}
          />
        )}

        {/* Left navigation sidebar */}
        <div className="fs-sidebar">
          <div className="fs-sidebar-header">
            <button className="fs-close-btn" onClick={handleClose} title="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="fs-sidebar-title">My Music</span>
          </div>

          <div className="fs-nav-list">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`fs-nav-item ${activeNav === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                onMouseEnter={playHover}
              >
                <span className="fs-nav-icon">{item.icon}</span>
                <span className="fs-nav-label">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="fs-sidebar-footer">
            <button
              className={`fs-nav-item ${showSettings ? 'active' : ''}`}
              onClick={() => { playSelect(); setShowSettings(!showSettings) }}
              onMouseEnter={playHover}
            >
              <span className="fs-nav-icon">⚙</span>
              <span className="fs-nav-label">Visualizer Settings</span>
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="fs-main">
          {/* Center: album art + track info */}
          <div className="fs-center">
            <div className="fs-artwork">
              {trackCover ? (
                <img src={trackCover} alt={trackName} className="fs-artwork-img" />
              ) : (
                <div className="fs-artwork-placeholder">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}
            </div>

            <div className="fs-track-info">
              <div className="fs-track-name">{trackName}</div>
              {trackArtist && <div className="fs-track-artist">{trackArtist}</div>}
            </div>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="fs-settings-panel" onClick={e => e.stopPropagation()}>
            <div className="fs-settings-header">
              <h3>Visualizer</h3>
              <button className="fs-settings-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="fs-settings-list">
              {VIZ_MODES.map(mode => (
                <button
                  key={mode.id}
                  className={`fs-settings-item ${vizMode === mode.id ? 'active' : ''}`}
                  onClick={() => { playSelect(); setVizMode(mode.id) }}
                  onMouseEnter={playHover}
                >
                  <span className="fs-settings-check">{vizMode === mode.id ? '●' : '○'}</span>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom player bar */}
        <div className="fs-player-bar" onClick={e => e.stopPropagation()}>
          <div className="fs-bar-left">
            <div className="fs-bar-track">
              {trackCover && <img src={trackCover} alt="" className="fs-bar-cover" />}
              <div className="fs-bar-info">
                <div className="fs-bar-name">{trackName}</div>
                {trackArtist && <div className="fs-bar-artist">{trackArtist}</div>}
              </div>
            </div>
          </div>

          <div className="fs-bar-center">
            <div className="fs-controls">
              <button className="fs-ctrl-btn" onClick={prev} title="Previous">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              <button className="fs-ctrl-btn fs-play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button className="fs-ctrl-btn" onClick={next} title="Next">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>

            <div className="fs-seek-row">
              <span className="fs-time">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="fs-seek"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
              />
              <span className="fs-time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="fs-bar-right">
            <button
              className="fs-ctrl-btn"
              onClick={toggleMute}
              style={{ opacity: isMuted || volume === 0 ? 0.5 : 1 }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                {isMuted || volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            <input
              type="range"
              className="fs-volume"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
