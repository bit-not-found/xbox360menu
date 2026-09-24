import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMusic } from '../context/MusicContext'

const backAudio = new Audio('./assets/audio/Back.mp3')
const playBack = () => { backAudio.currentTime = 0; backAudio.play().catch(() => {}) }

let butterchurnLib = null
let butterchurnPresetsLib = null

export default function AudioVisualizer({ onClose, isActive }) {
  const canvasRef = useRef(null)
  const visualizerRef = useRef(null)
  const animFrameRef = useRef(null)
  const [isClosing, setIsClosing] = useState(false)
  const [supported, setSupported] = useState(true)
  const [currentPreset, setCurrentPreset] = useState('')
  const [presetList, setPresetList] = useState([])
  const [showPresets, setShowPresets] = useState(false)

  const {
    isPlaying,
    getAudioContext,
    getAnalyser,
    connectAudioSource,
    audioRef,
    currentTrack,
    currentTime,
    duration,
    volume,
    isMuted,
    formatTime,
    togglePlay,
    next,
    prev,
    seek,
    toggleMute,
    setVolume,
  } = useMusic()

  const getCoverUrl = (track) => {
    if (!track) return ''
    return track.cover || ''
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
  }, [isActive])

  useEffect(() => {
    const handleGuideOpened = () => {
      if (!isClosing) handleClose()
    }
    window.addEventListener('guide-opened', handleGuideOpened)
    return () => window.removeEventListener('guide-opened', handleGuideOpened)
  }, [isClosing])

  const handleClose = () => {
    playBack()
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }

  // Load butterchurn lazily
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [bc, bcp] = await Promise.all([
          import('butterchurn'),
          import('butterchurn-presets'),
        ])
        if (cancelled) return
        butterchurnLib = bc.default || bc
        butterchurnPresetsLib = bcp.default || bcp

        const isSupported = butterchurnLib.default
          ? butterchurnLib.default.isSupported()
          : butterchurnLib.isSupported()

        if (!isSupported) {
          setSupported(false)
          return
        }

        const presets = butterchurnPresetsLib.getPresets()
        const names = Object.keys(presets)
        setPresetList(names)
        if (names.length > 0) {
          setCurrentPreset(names[Math.floor(Math.random() * names.length)])
        }
      } catch (e) {
        console.error('Failed to load butterchurn:', e)
        setSupported(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Initialize visualizer when canvas + preset are ready
  useEffect(() => {
    if (!canvasRef.current || !butterchurnLib || !currentPreset || !supported) return

    const canvas = canvasRef.current
    const parent = canvas.parentElement
    // Layout size — immune to the scale() entry animation on the overlay
    const rectW = parent ? parent.offsetWidth : 0
    const rectH = parent ? parent.offsetHeight : 0

    try {
      const createViz = butterchurnLib.default || butterchurnLib
      const viz = createViz(getAudioContext(), canvas, {
        width: Math.floor(rectW),
        height: Math.floor(rectH),
      })

      const presets = butterchurnPresetsLib.getPresets()
      viz.loadPreset(presets[currentPreset], 0.0)
      viz.setRendererSize(Math.floor(rectW), Math.floor(rectH))

      const analyser = getAnalyser()
      if (analyser) {
        viz.connectAudio(analyser)
      }

      visualizerRef.current = viz

      const renderLoop = () => {
        if (visualizerRef.current) {
          try {
            visualizerRef.current.render()
          } catch {}
        }
        animFrameRef.current = requestAnimationFrame(renderLoop)
      }
      renderLoop()
    } catch (e) {
      console.error('Failed to create visualizer:', e)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      visualizerRef.current = null
    }
  }, [currentPreset, supported, getAudioContext, getAnalyser])

  // Handle resize (ResizeObserver catches layout changes; offset dims ignore transforms)
  useEffect(() => {
    if (!canvasRef.current) return
    const parent = canvasRef.current.parentElement
    if (!parent) return

    const handleResize = () => {
      if (!canvasRef.current || !visualizerRef.current) return
      const w = parent.offsetWidth
      const h = parent.offsetHeight
      if (!w || !h) return
      canvasRef.current.width = w
      canvasRef.current.height = h
      try {
        visualizerRef.current.setRendererSize(w, h)
      } catch {}
    }

    const ro = new ResizeObserver(handleResize)
    ro.observe(parent)
    window.addEventListener('resize', handleResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const changePreset = useCallback((name) => {
    setCurrentPreset(name)
    setShowPresets(false)
  }, [])

  const randomPreset = useCallback(() => {
    if (presetList.length === 0) return
    const idx = Math.floor(Math.random() * presetList.length)
    setCurrentPreset(presetList[idx])
  }, [presetList])

  const content = (
    <div className={`visualizer-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="visualizer-container" onClick={e => e.stopPropagation()}>
        <div className="visualizer-canvas-wrap">
          <canvas ref={canvasRef} className="visualizer-canvas" />
        </div>

        <div className="visualizer-controls">
          <div className="visualizer-left">
            <button className="visualizer-ctrl-btn" onClick={handleClose} title="Back">
              ✕
            </button>
          </div>

          <div className="visualizer-center">
            <div className="visualizer-track-info">
              {trackCover && <img src={trackCover} alt="" className="visualizer-cover" />}
              <div className="visualizer-track-text">
                <span className="visualizer-track-name">{trackName}</span>
                {trackArtist && <span className="visualizer-track-artist">{trackArtist}</span>}
              </div>
            </div>

            <div className="visualizer-playback">
              <button className="visualizer-ctrl-btn" onClick={prev}>
                <img src="./assets/icons/previous.png" alt="Prev" style={{ width: 20, height: 20 }} />
              </button>
              <button className="visualizer-ctrl-btn visualizer-play-btn" onClick={togglePlay}>
                <img src={isPlaying ? "./assets/icons/stop.png" : "./assets/icons/play.png"} alt="Play" style={{ width: 28, height: 28 }} />
              </button>
              <button className="visualizer-ctrl-btn" onClick={next}>
                <img src="./assets/icons/next.png" alt="Next" style={{ width: 20, height: 20 }} />
              </button>
              <span className="visualizer-time">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="visualizer-seek"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
              />
              <span className="visualizer-time">{formatTime(duration)}</span>
              <button className="visualizer-ctrl-btn" onClick={toggleMute} style={{ opacity: isMuted || volume === 0 ? 0.5 : 1 }}>
                <img src="./assets/icons/Volume.png" alt="Volume" style={{ width: 24, height: 24 }} />
              </button>
              <input
                type="range"
                className="visualizer-volume"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="visualizer-right">
            <button className="visualizer-ctrl-btn visualizer-preset-btn" onClick={randomPreset} title="Random Preset">
              🎲
            </button>
            <button className={`visualizer-ctrl-btn visualizer-preset-btn ${showPresets ? 'active' : ''}`} onClick={() => setShowPresets(!showPresets)} title="Presets">
              ☰
            </button>
          </div>
        </div>

        {showPresets && (
          <div className="visualizer-preset-list" onClick={e => e.stopPropagation()}>
            {presetList.map(name => (
              <div
                key={name}
                className={`visualizer-preset-item ${name === currentPreset ? 'active' : ''}`}
                onClick={() => changePreset(name)}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
