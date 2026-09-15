import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '../context/ConfigContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')
const pageLeftAudio = new Audio('./assets/audio/Page Left.mp3')
const pageRightAudio = new Audio('./assets/audio/Page Right.mp3')

const blades = [
  { id: 'xbox', label: 'Xbox' },
  { id: 'social', label: 'Social' },
  { id: 'media', label: 'Media' },
  { id: 'settings', label: 'Settings' },
]

const subdomains = [
  { label: 'Ludaba', url: 'https://ludaba.panashe.co.za' },
  { label: 'Dashboard', url: 'https://dash.panashe.co.za' },
  { label: 'Games', url: 'https://games.panashe.co.za' },
  { label: 'Blog', url: 'https://blog.panashe.co.za' },
  { label: 'Desktop', url: 'https://desktop.panashe.co.za' },
]

const navItems = [
  { id: 0, label: 'Home' },
  { id: 1, label: 'Social' },
  { id: 2, label: 'Media' },
  { id: 3, label: 'Games' },
  { id: 4, label: 'Music' },
  { id: 5, label: 'Apps' },
  { id: 6, label: 'Settings' },
]

export default function XboxGuide({ onClose, onQuitToDashboard, activeCategory, onNavigate, activeApp, onCloseApp }) {
  const { config } = useConfig()
  const [isClosing, setIsClosing] = useState(false)
  const [activeBlade, setActiveBlade] = useState(0)
  const [slideDir, setSlideDir] = useState(null)
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)
  const [soundFx, setSoundFx] = useState(true)
  const bladeTimeout = useRef(null)

  const allGames = config?.myGames || []
  const pinnedGames = allGames.filter(g => g.isPinned)
  const recentGames = [...allGames]
    .filter(g => g.lastPlayed)
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .slice(0, 4)
  const totalGamerscore = allGames.reduce((sum, g) => sum + (g.stars || 0) * 100, 0)

  const handleClose = useCallback(() => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosing(true)
    setTimeout(() => onClose(), 320)
  }, [onClose])

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

  const switchBlade = useCallback((dir) => {
    const next = activeBlade + dir
    if (next < 0 || next >= blades.length) return
    if (dir > 0) {
      pageRightAudio.currentTime = 0
      pageRightAudio.play().catch(() => {})
    } else {
      pageLeftAudio.currentTime = 0
      pageLeftAudio.play().catch(() => {})
    }
    setSlideDir(dir > 0 ? 'left' : 'right')
    setActiveBlade(next)
    if (bladeTimeout.current) clearTimeout(bladeTimeout.current)
    bladeTimeout.current = setTimeout(() => setSlideDir(null), 350)
  }, [activeBlade])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        switchBlade(-1)
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        switchBlade(1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [switchBlade])

  const handleNav = (catIndex) => {
    playSelect()
    if (onNavigate) onNavigate(catIndex)
    onClose()
  }

  const handleCloseApp = () => {
    playSelect()
    if (onCloseApp) onCloseApp()
  }

  const renderBladeContent = () => {
    switch (blades[activeBlade].id) {
      case 'xbox': return renderXboxBlade()
      case 'social': return renderSocialBlade()
      case 'media': return renderMediaBlade()
      case 'settings': return renderSettingsBlade()
      default: return null
    }
  }

  // ──── XBOX BLADE ────
  function renderXboxBlade() {
    return (
      <>
        {/* Active App */}
        {activeApp && (
          <div className="g-section g-active-section">
            <div className="g-section-label">Currently Running</div>
            <div className="g-active-app">
              <div className="g-active-app-left">
                <div className="g-active-dot"></div>
                <span className="g-active-name">{activeApp.label || activeApp.url}</span>
              </div>
              <button className="g-active-close" onClick={handleCloseApp} onMouseEnter={playHover}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Gamerscore */}
        <div className="g-section">
          <div className="g-stat-row">
            <span className="g-stat-label">Gamerscore</span>
            <span className="g-stat-value g-gold">G {totalGamerscore || 10450}</span>
          </div>
          <div className="g-stat-row">
            <span className="g-stat-label">Games</span>
            <span className="g-stat-value">{allGames.length}</span>
          </div>
          <div className="g-stat-row">
            <span className="g-stat-label">Pinned</span>
            <span className="g-stat-value">{pinnedGames.length}</span>
          </div>
        </div>

        {/* Recent */}
        {recentGames.length > 0 && (
          <div className="g-section">
            <div className="g-section-label">Recently Played</div>
            {recentGames.map(game => (
              <div key={game.name} className="g-list-item" onMouseEnter={playHover}>
                <div className="g-list-thumb"><img src={game.icon} alt={game.name} /></div>
                <div className="g-list-info">
                  <span className="g-list-name">{game.name}</span>
                  <span className="g-list-stars">{'★'.repeat(game.stars || 0) + '☆'.repeat(5 - (game.stars || 0))}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Nav */}
        <div className="g-section">
          <div className="g-section-label">Quick Launch</div>
          <div className="g-nav-list">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`g-nav-item ${item.id === activeCategory ? 'g-nav-active' : ''}`}
                onClick={() => handleNav(item.id)}
                onMouseEnter={playHover}
              >
                <span className="g-nav-text">{item.label}</span>
                {item.id === activeCategory && <span className="g-nav-dot"></span>}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ──── SOCIAL BLADE ────
  function renderSocialBlade() {
    return (
      <>
        <div className="g-section">
          <div className="g-section-label">Friends</div>
          <div className="g-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span>No friends online</span>
          </div>
        </div>

        <div className="g-section">
          <div className="g-section-label">Messages</div>
          <div className="g-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>No new messages</span>
          </div>
        </div>

        <div className="g-section">
          <div className="g-section-label">Subdomains</div>
          <div className="g-subdomain-list">
            {subdomains.map(sub => (
              <button
                key={sub.label}
                className="g-subdomain-item"
                onMouseEnter={playHover}
                onClick={() => {
                  playSelect()
                  if (onCloseApp) onCloseApp()
                  window.open(sub.url, '_blank')
                  onClose()
                }}
              >
                <span className="g-subdomain-arrow">›</span>
                <span>{sub.label}</span>
                <span className="g-subdomain-url">{sub.url.replace('https://', '')}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ──── MEDIA BLADE ────
  function renderMediaBlade() {
    return (
      <>
        <div className="g-section">
          <div className="g-section-label">Quick Launch</div>
          <div className="g-media-grid">
            <button className="g-media-tile" onMouseEnter={playHover} onClick={() => { playSelect(); handleNav(4) }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
              <span>Music</span>
            </button>
            <button className="g-media-tile" onMouseEnter={playHover} onClick={() => { playSelect(); handleNav(2) }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>Video</span>
            </button>
          </div>
        </div>

        <div className="g-section">
          <div className="g-section-label">Volume</div>
          <div className="g-volume-row">
            <button className="g-vol-btn" onMouseEnter={playHover} onClick={() => { playSelect(); setMuted(!muted) }}>
              {muted ? '🔇' : volume > 50 ? '🔊' : volume > 0 ? '🔉' : '🔇'}
            </button>
            <input
              type="range" min="0" max="100"
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
              className="g-volume-slider"
            />
            <span className="g-vol-pct">{muted ? 0 : volume}%</span>
          </div>
        </div>

        <div className="g-section">
          <div className="g-section-label">Sound Effects</div>
          <div className="g-toggle-row">
            <span className="g-toggle-label">{soundFx ? 'On' : 'Off'}</span>
            <button
              className={`g-toggle ${soundFx ? 'g-toggle-on' : ''}`}
              onClick={() => { playSelect(); setSoundFx(!soundFx) }}
              onMouseEnter={playHover}
            >
              <div className="g-toggle-knob"></div>
            </button>
          </div>
        </div>
      </>
    )
  }

  // ──── SETTINGS BLADE ────
  function renderSettingsBlade() {
    return (
      <>
        <div className="g-section">
          <div className="g-section-label">System</div>
          <div className="g-stat-row">
            <span className="g-stat-label">Platform</span>
            <span className="g-stat-value">WinX360</span>
          </div>
          <div className="g-stat-row">
            <span className="g-stat-label">Version</span>
            <span className="g-stat-value">1.0.0</span>
          </div>
          <div className="g-stat-row">
            <span className="g-stat-label">Theme</span>
            <span className="g-stat-value">Metro</span>
          </div>
          <div className="g-stat-row">
            <span className="g-stat-label">Active Tab</span>
            <span className="g-stat-value g-green">{navItems[activeCategory]?.label || 'Home'}</span>
          </div>
        </div>

        <div className="g-section">
          <div className="g-section-label">Actions</div>
          <button
            className="g-action-row"
            onMouseEnter={playHover}
            onClick={() => { playSelect(); handleNav(6) }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>System Settings</span>
            <span className="g-action-arrow">›</span>
          </button>
          <button
            className="g-action-row"
            onMouseEnter={playHover}
            onClick={() => { playSelect(); handleNav(1) }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profile</span>
            <span className="g-action-arrow">›</span>
          </button>
        </div>

        <div className="g-section">
          <div className="g-section-label">Power</div>
          <button
            className="g-quit-btn"
            onMouseEnter={playHover}
            onClick={() => { playSelect(); onQuitToDashboard() }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Quit to Dashboard</span>
          </button>
        </div>
      </>
    )
  }

  return createPortal(
    <div className={`g-overlay ${isClosing ? 'g-closing' : ''}`} onClick={handleClose}>
      <div className={`g-blade ${isClosing ? 'g-blade-closing' : ''}`} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="g-header">
          <div className="g-header-left">
            <div className="g-xbox-logo">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                <circle cx="12" cy="12" r="11" stroke="#107c10" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="8" stroke="#107c10" strokeWidth="0.5" opacity="0.4" />
                <text x="12" y="16" textAnchor="middle" fill="#107c10" fontSize="10" fontWeight="bold" fontFamily="Segoe UI">X</text>
              </svg>
            </div>
            <span className="g-header-title">Xbox Guide</span>
          </div>
          <div className="g-header-right">
            <div className="g-avatar"></div>
            <div className="g-header-info">
              <span className="g-gamertag">Player 1</span>
              <span className="g-gamerscore-badge">G {totalGamerscore || 10450}</span>
            </div>
          </div>
        </div>

        {/* ── Blade Tabs (LB / RB) ── */}
        <div className="g-blade-tabs">
          <button className="g-bumper" onClick={() => switchBlade(-1)} onMouseEnter={playHover} disabled={activeBlade === 0}>
            <span className="g-bumper-key">LB</span>
          </button>
          <div className="g-blade-tab-list">
            {blades.map((blade, i) => (
              <div
                key={blade.id}
                className={`g-blade-tab ${i === activeBlade ? 'g-blade-tab-active' : ''}`}
              >
                {blade.label}
              </div>
            ))}
          </div>
          <button className="g-bumper" onClick={() => switchBlade(1)} onMouseEnter={playHover} disabled={activeBlade === blades.length - 1}>
            <span className="g-bumper-key">RB</span>
          </button>
        </div>

        {/* ── Content ── */}
        <div className={`g-content ${slideDir ? `g-slide-${slideDir}` : ''}`}>
          {renderBladeContent()}
        </div>

        {/* ── Footer: Button Prompts ── */}
        <div className="g-footer">
          <div className="g-prompt">
            <span className="g-btn-icon g-btn-a">A</span>
            <span className="g-prompt-text">Select</span>
          </div>
          <div className="g-prompt">
            <span className="g-btn-icon g-btn-b">B</span>
            <span className="g-prompt-text">Back</span>
          </div>
          <div className="g-prompt">
            <span className="g-btn-icon g-btn-x">X</span>
            <span className="g-prompt-text">Close App</span>
          </div>
          <div className="g-prompt">
            <span className="g-btn-icon g-btn-y">Y</span>
            <span className="g-prompt-text">Dashboard</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
