import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Nostalgist } from 'nostalgist'
import { useConfig } from '../context/ConfigContext'

const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

let activeNostalgist = null

export default function AppWindow({ app, onClose, onMinimize, minimized }) {
  const { config } = useConfig()
  const [isClosing, setIsClosing] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showNav, setShowNav] = useState(true)
  const [emulatorReady, setEmulatorReady] = useState(false)
  const navTimeout = useRef(null)
  const iframeRef = useRef(null)

  const isEmulator = app.type === 'emulator'
  const isExternal = app.type === 'external'
  const isInternal = app.type === 'internal'

  const handleClose = useCallback(() => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosing(true)
    if (activeNostalgist) {
      try { activeNostalgist.exit() } catch { /* noop */ }
      activeNostalgist = null
    }
    setTimeout(() => onClose(), 350)
  }, [onClose])

  const handleMinimize = useCallback(() => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
    if (activeNostalgist) {
      try { activeNostalgist.pause() } catch { /* noop */ }
      const canvas = activeNostalgist.getCanvas()
      if (canvas) canvas.style.display = 'none'
    }
    if (onMinimize) onMinimize()
  }, [onMinimize])

  useEffect(() => {
    const handleMouseMove = () => {
      setShowNav(true)
      if (navTimeout.current) clearTimeout(navTimeout.current)
      navTimeout.current = setTimeout(() => setShowNav(false), 3000)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (navTimeout.current) clearTimeout(navTimeout.current)
    }
  }, [])

  // Nostalgist emulator setup
  useEffect(() => {
    if (!isEmulator) return
    if (minimized) return

    // If we already have an active emulator for this same ROM, just show and resume
    if (activeNostalgist && app._lastLabel === app.label) {
      try {
        const canvas = activeNostalgist.getCanvas()
        if (canvas) {
          canvas.style.display = ''
          canvas.style.zIndex = '200'
        }
        activeNostalgist.resume()
        setEmulatorReady(true)
      } catch { /* noop */ }
      return
    }

    // If a different ROM is launching, exit the old emulator first
    if (activeNostalgist) {
      try { activeNostalgist.exit() } catch { /* noop */ }
      activeNostalgist = null
    }

    let destroyed = false

    const launchEmulator = async () => {
      try {
        const romOption = app.fileName
          ? { fileContent: app.rom, fileName: app.fileName }
          : app.rom

        const controllerSettings = config?.controllerSettings || {}
        const assignments = controllerSettings.playerAssignments || [{ type: 'keyboard' }, null, null, null]

        const retroarchConfig = {
          rewind_enable: true,
          savestate_thumbnail_enable: true,
        }

        const p1 = assignments[0]
        const p2 = assignments[1]

        if (p1?.type === 'gamepad') {
          retroarchConfig.input_player1_joypad_index = String(p1.index)
        }
        if (p2?.type === 'gamepad') {
          retroarchConfig.input_player2_joypad_index = String(p2.index)
        }

        const nostalgist = await Nostalgist.launch({
          core: app.core || 'fceumm',
          rom: romOption,
          retroarchConfig,
        })

        if (destroyed) {
          try { nostalgist.exit() } catch { /* noop */ }
          return
        }

        activeNostalgist = nostalgist
        app._lastLabel = app.label

        const canvas = nostalgist.getCanvas()
        if (canvas) {
          canvas.style.zIndex = '200'
        }

        setEmulatorReady(true)
      } catch (err) {
        console.error('Emulator launch failed:', err)
      }
    }

    launchEmulator()

    return () => {
      destroyed = true
    }
  }, [isEmulator, app.core, app.rom, minimized])

  // Cleanup on unmount only: destroy emulator if component is removed (close via Taskbar/Guide)
  useEffect(() => {
    if (!isEmulator) return
    return () => {
      if (activeNostalgist) {
        try { activeNostalgist.exit() } catch { /* noop */ }
        activeNostalgist = null
      }
    }
  }, [isEmulator])

  // Handle minimized state changes for emulator
  useEffect(() => {
    if (!isEmulator || !activeNostalgist) return
    try {
      const canvas = activeNostalgist.getCanvas()
      if (!canvas) return
      if (minimized) {
        canvas.style.display = 'none'
        activeNostalgist.pause()
      } else {
        canvas.style.display = ''
        canvas.style.zIndex = '200'
        activeNostalgist.resume()
      }
    } catch { /* noop */ }
  }, [isEmulator, minimized])

  // Emulator apps: just render a floating toolbar, Nostalgist manages the canvas
  if (isEmulator) {
    return createPortal(
      <div
        className={`emulator-toolbar ${minimized ? 'minimized' : ''} ${isClosing ? 'closing' : ''}`}
      >
        <div className={`app-window-bar ${!showNav ? 'hidden' : ''}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300 }}>
          <div className="app-window-bar-left">
            <button className="app-window-back" onClick={handleMinimize} title="Back to dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="app-window-title">{app.label || 'Game'}</span>
            {app.systemName && (
              <span className="app-window-system-badge">{app.systemName}</span>
            )}
          </div>
          <div className="app-window-bar-right">
            {emulatorReady && (
              <>
                <button className="app-window-btn" onClick={() => {
                  try { activeNostalgist?.restart() } catch { /* noop */ }
                }} title="Restart">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
                <button className="app-window-btn" onClick={() => {
                  try {
                    const state = activeNostalgist?.saveState()
                    if (state) state.then(({ blob }) => {
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `${app.label || 'save'}.state`
                      a.click()
                    })
                  } catch { /* noop */ }
                }} title="Save State">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </button>
              </>
            )}
            <button className="app-window-close" onClick={handleClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // Non-emulator apps: standard iframe/internal window
  return createPortal(
    <div className={`app-window-overlay ${isClosing ? 'closing' : ''} ${minimized ? 'minimized' : ''}`}>
      <div className="app-window fullscreen">
        <div className={`app-window-bar ${!showNav ? 'hidden' : ''}`}>
          <div className="app-window-bar-left">
            <button className="app-window-back" onClick={handleMinimize} title="Back to dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="app-window-title">{app.label || app.url || 'App'}</span>
          </div>
          <div className="app-window-bar-right">
            <button className="app-window-close" onClick={handleClose} title="Close app">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="app-window-content">
          {isExternal && (
            <>
              {!iframeLoaded && (
                <div className="app-window-loading">
                  <div className="app-window-loading-spinner"></div>
                  <span>Loading {app.label || 'app'}...</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={app.url}
                className={`app-window-iframe ${iframeLoaded ? 'loaded' : ''}`}
                onLoad={() => setIframeLoaded(true)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
              />
            </>
          )}
          {isInternal && app.component && (
            <div className="app-window-internal">
              {app.component}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
