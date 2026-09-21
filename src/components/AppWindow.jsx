import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Nostalgist } from 'nostalgist'
import { useConfig } from '../context/ConfigContext'

const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

let activeNostalgist = null

const XBOX_BTN_INDEX = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9, ls: 10, rs: 11,
  'dpad-up': 12, 'dpad-down': 13, 'dpad-left': 14, 'dpad-right': 15,
}

const RETROARCH_BTN_KEY = {
  a: 'a', b: 'b', x: 'x', y: 'y',
  lb: 'l', rb: 'r', lt: 'l2', rt: 'r2',
  back: 'select', start: 'start',
  ls: 'l3', rs: 'r3',
  'dpad-up': 'up', 'dpad-down': 'down',
  'dpad-left': 'left', 'dpad-right': 'right',
}

function jsKeyToRetroarch(code) {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  const map = {
    Space: 'space', Enter: 'return', Escape: 'escape',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    ShiftLeft: 'lshift', ShiftRight: 'rshift',
    ControlLeft: 'lctrl', ControlRight: 'rctrl',
    AltLeft: 'lalt', AltRight: 'ralt',
    Tab: 'tab', Backspace: 'backspace', Delete: 'delete',
    BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
    Slash: '/', Backslash: '\\', Backquote: '`',
    Minus: '-', Equal: '=',
  }
  return map[code] || code.toLowerCase()
}

function buildRetroarchInputConfig(controllerSettings) {
  const config = {}
  const assignments = controllerSettings?.playerAssignments || []
  const bindings = controllerSettings?.bindings || {}

  for (let i = 0; i < 4; i++) {
    const assignment = assignments[i]
    if (!assignment) continue

    const playerBindings = bindings[i] || {}
    const playerNum = i + 1

    if (assignment.type === 'gamepad') {
      config[`input_player${playerNum}_joypad_index`] = String(assignment.index)

      for (const [virtualBtn, defaultIdx] of Object.entries(XBOX_BTN_INDEX)) {
        const retroKey = RETROARCH_BTN_KEY[virtualBtn]
        if (!retroKey) continue

        const binding = playerBindings[virtualBtn]
        if (binding && typeof binding === 'string' && binding.startsWith('gamepad:')) {
          const gpBtn = binding.replace('gamepad:', '')
          const gpIdx = XBOX_BTN_INDEX[gpBtn]
          config[`input_player${playerNum}_${retroKey}_btn`] = gpIdx !== undefined ? String(gpIdx) : String(defaultIdx)
        } else {
          config[`input_player${playerNum}_${retroKey}_btn`] = String(defaultIdx)
        }
      }
    } else if (assignment.type === 'keyboard') {
      for (const [virtualBtn] of Object.entries(XBOX_BTN_INDEX)) {
        const binding = playerBindings[virtualBtn]
        if (binding && typeof binding === 'string' && !binding.startsWith('gamepad:')) {
          const keyName = jsKeyToRetroarch(binding)
          if (keyName) {
            config[`input_player${playerNum}_key_${virtualBtn}`] = keyName
          }
        }
      }
    }
  }

  return config
}

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

        const retroarchConfig = {
          rewind_enable: true,
          savestate_thumbnail_enable: true,
          ...buildRetroarchInputConfig(controllerSettings),
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
