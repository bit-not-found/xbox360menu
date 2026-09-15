import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

export default function AppWindow({ app, onClose, onMinimize, minimized }) {
  const [isClosing, setIsClosing] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showNav, setShowNav] = useState(true)
  const navTimeout = useRef(null)
  const iframeRef = useRef(null)

  const handleClose = useCallback(() => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosing(true)
    setTimeout(() => onClose(), 350)
  }, [onClose])

  const handleMinimize = useCallback(() => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
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

  const isExternal = app.type === 'external'
  const isInternal = app.type === 'internal'

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
