import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

export default function AppWindow({ app, onClose }) {
  const [isClosing, setIsClosing] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [showNav, setShowNav] = useState(true)
  const navTimeout = useRef(null)
  const iframeRef = useRef(null)

  const handleClose = useCallback(() => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosing(true)
    setTimeout(() => onClose(), 350)
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  useEffect(() => {
    const handleMouseMove = () => {
      setShowNav(true)
      if (navTimeout.current) clearTimeout(navTimeout.current)
      navTimeout.current = setTimeout(() => {
        if (isFullscreen) setShowNav(false)
      }, 3000)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (navTimeout.current) clearTimeout(navTimeout.current)
    }
  }, [isFullscreen])

  const handleBack = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
    if (isFullscreen) {
      setIsFullscreen(false)
    } else {
      handleClose()
    }
  }

  const isExternal = app.type === 'external'
  const isInternal = app.type === 'internal'

  return createPortal(
    <div className={`app-window-overlay ${isClosing ? 'closing' : ''}`}>
      <div className={`app-window ${isFullscreen ? 'fullscreen' : ''}`}>
        {/* Title bar */}
        <div className={`app-window-bar ${isFullscreen && !showNav ? 'hidden' : ''}`}>
          <div className="app-window-bar-left">
            <button className="app-window-back" onClick={handleBack} title="Back (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="app-window-title">{app.label || app.url || 'App'}</span>
          </div>
          <div className="app-window-bar-right">
            <button className="app-window-btn" onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                ) : (
                  <path d="M8 3H5a2 2 0 00-2 2v3m20-5h-3m3 0v3m0 12v-3m0 3h-3M3 16v3a2 2 0 002 2h3" />
                )}
              </svg>
            </button>
            <button className="app-window-close" onClick={handleClose} title="Close (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content area */}
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
