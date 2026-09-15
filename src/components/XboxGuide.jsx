import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '../context/ConfigContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

const navItems = [
  { id: 0, label: 'Home', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )},
  { id: 1, label: 'Social', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )},
  { id: 2, label: 'Media', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )},
  { id: 3, label: 'Games', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <circle cx="18" cy="11" r="1" fill="currentColor" />
      <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  )},
  { id: 4, label: 'Music', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )},
  { id: 5, label: 'Apps', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )},
  { id: 6, label: 'Settings', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )},
]

export default function XboxGuide({ onClose, onQuitToDashboard, activeCategory, onNavigate, activeApp, onCloseApp }) {
  const { config } = useConfig()
  const [isClosing, setIsClosing] = useState(false)
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)
  const [soundFx, setSoundFx] = useState(true)

  const allGames = config?.myGames || []
  const pinnedGames = allGames.filter(g => g.isPinned)
  const recentGames = [...allGames]
    .filter(g => g.lastPlayed)
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .slice(0, 3)

  const totalGamerscore = allGames.reduce((sum, g) => sum + (g.stars || 0) * 100, 0)

  const handleClose = useCallback(() => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const playHover = () => {
    if (!soundFx) return
    hoverAudio.currentTime = 0
    hoverAudio.play().catch(() => {})
  }

  const playSelect = () => {
    if (!soundFx) return
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
  }

  const handleNav = (catIndex) => {
    playSelect()
    if (onNavigate) onNavigate(catIndex)
    onClose()
  }

  const handleCloseApp = () => {
    playSelect()
    if (onCloseApp) onCloseApp()
  }

  return createPortal(
    <div className={`guide-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div
        className={`guide-blade ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="guide-header">
          <div className="guide-xbox-logo">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#108710" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" strokeLinecap="round" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="guide-xbox-text">Xbox Guide</span>
          </div>
          <div className="guide-profile-mini">
            <div className="guide-avatar-mini"></div>
            <span className="guide-gamertag-mini">Player 1</span>
            <span className="guide-gamerscore-mini">G {totalGamerscore || 10450}</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="guide-content">

          {/* Active App */}
          {activeApp && (
            <div className="guide-section guide-active-app-section">
              <h3 className="guide-section-title">Running</h3>
              <div className="guide-active-app">
                <div className="guide-active-app-info">
                  <div className="guide-active-app-dot"></div>
                  <span className="guide-active-app-name">{activeApp.label || activeApp.url || 'App'}</span>
                </div>
                <button
                  className="guide-active-app-close"
                  onClick={handleCloseApp}
                  onMouseEnter={playHover}
                  title="Close app"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Quick Nav */}
          <div className="guide-section">
            <h3 className="guide-section-title">Navigate</h3>
            <div className="guide-nav-grid">
              {navItems.map(item => (
                <button
                  key={item.id}
                  className={`guide-nav-tile ${item.id === activeCategory ? 'active' : ''}`}
                  onClick={() => handleNav(item.id)}
                  onMouseEnter={playHover}
                >
                  <div className="guide-nav-icon">{item.icon}</div>
                  <span className="guide-nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Games */}
          {recentGames.length > 0 && (
            <div className="guide-section">
              <h3 className="guide-section-title">Recent</h3>
              {recentGames.map(game => (
                <div key={game.name} className="guide-list-item" onMouseEnter={playHover}>
                  <div className="guide-list-thumb">
                    <img src={game.icon} alt={game.name} />
                  </div>
                  <div className="guide-list-info">
                    <span className="guide-list-name">{game.name}</span>
                    <span className="guide-list-sub">{'★'.repeat(game.stars || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pinned */}
          {pinnedGames.length > 0 && (
            <div className="guide-section">
              <h3 className="guide-section-title">Pinned</h3>
              {pinnedGames.slice(0, 3).map(game => (
                <div key={game.name} className="guide-list-item" onMouseEnter={playHover}>
                  <div className="guide-list-thumb">
                    <img src={game.icon} alt={game.name} />
                  </div>
                  <div className="guide-list-info">
                    <span className="guide-list-name">{game.name}</span>
                    <span className="guide-list-sub">{'★'.repeat(game.stars || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subdomains */}
          <div className="guide-section">
            <h3 className="guide-section-title">Subdomains</h3>
            <div className="guide-subdomain-chips">
              {[
                { label: 'Ludaba', url: 'https://ludaba.panashe.co.za' },
                { label: 'Dashboard', url: 'https://dash.panashe.co.za' },
                { label: 'Games', url: 'https://games.panashe.co.za' },
                { label: 'Blog', url: 'https://blog.panashe.co.za' },
                { label: 'Desktop', url: 'https://desktop.panashe.co.za' },
              ].map(sub => (
                <button
                  key={sub.label}
                  className="guide-subdomain-chip"
                  onMouseEnter={playHover}
                  onClick={() => {
                    playSelect()
                    if (onCloseApp) onCloseApp()
                    window.open(sub.url, '_blank')
                    onClose()
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {/* System Controls */}
          <div className="guide-section">
            <h3 className="guide-section-title">System</h3>
            <div className="guide-controls">
              <div className="guide-control-row">
                <span className="guide-control-label">
                  {muted ? '🔇' : volume > 50 ? '🔊' : volume > 0 ? '🔉' : '🔇'} Volume
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={muted ? 0 : volume}
                  onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
                  className="guide-volume-slider"
                />
                <span className="guide-control-value">{muted ? 0 : volume}%</span>
              </div>
              <div className="guide-control-row">
                <span className="guide-control-label">🔊 Sound FX</span>
                <button
                  className={`guide-toggle ${soundFx ? 'on' : ''}`}
                  onClick={() => { playSelect(); setSoundFx(!soundFx) }}
                  onMouseEnter={playHover}
                >
                  <div className="guide-toggle-thumb"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="guide-section">
            <h3 className="guide-section-title">Quick Actions</h3>
            <div className="guide-actions-grid">
              <button
                className="guide-action-tile"
                onMouseEnter={playHover}
                onClick={() => { playSelect(); handleNav(4) }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span>Music</span>
              </button>
              <button
                className="guide-action-tile"
                onMouseEnter={playHover}
                onClick={() => { playSelect(); handleNav(2) }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <span>Video</span>
              </button>
              <button
                className="guide-action-tile"
                onMouseEnter={playHover}
                onClick={() => { playSelect(); handleNav(5) }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Apps</span>
              </button>
              <button
                className="guide-action-tile"
                onMouseEnter={playHover}
                onClick={() => { playSelect(); handleNav(6) }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="guide-footer">
          <button
            className="guide-footer-btn guide-quit-btn"
            onClick={() => { playSelect(); onQuitToDashboard() }}
            onMouseEnter={playHover}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Quit to Dashboard</span>
          </button>
          <div className="guide-footer-hint">
            <span className="guide-shortcut-hint">Esc to close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
