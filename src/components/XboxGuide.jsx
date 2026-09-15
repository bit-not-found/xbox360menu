import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '../context/ConfigContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

export default function XboxGuide({ onClose, onQuitToDashboard, activeCategory, categories }) {
  const { config } = useConfig()
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState('xbox')
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)

  const allGames = config?.myGames || []
  const allApps = config?.myApps || []
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
    hoverAudio.currentTime = 0
    hoverAudio.play().catch(() => {})
  }

  const playSelect = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
  }

  const tabs = [
    { id: 'xbox', label: 'Xbox' },
    { id: 'media', label: 'Media' },
    { id: 'games', label: 'Games' },
    { id: 'system', label: 'System' },
  ]

  return createPortal(
    <div className={`guide-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div
        className={`guide-blade ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Guide header */}
        <div className="guide-header">
          <div className="guide-xbox-logo">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#108710" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" strokeLinecap="round" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="guide-xbox-text">Xbox Guide</span>
          </div>
          <div className="guide-profile-mini">
            <div className="guide-avatar-mini"></div>
            <span className="guide-gamertag-mini">Player 1</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="guide-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`guide-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { playSelect(); setActiveTab(tab.id) }}
              onMouseEnter={playHover}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="guide-content">
          {activeTab === 'xbox' && (
            <div className="guide-tab-content">
              <div className="guide-section">
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Gamerscore</span>
                  <span className="guide-stat-value gamerscore">{totalGamerscore > 0 ? `G ${totalGamerscore}` : 'G 0'}</span>
                </div>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Games</span>
                  <span className="guide-stat-value">{allGames.length}</span>
                </div>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Apps</span>
                  <span className="guide-stat-value">{allApps.length}</span>
                </div>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Pinned</span>
                  <span className="guide-stat-value">{pinnedGames.length}</span>
                </div>
              </div>

              {recentGames.length > 0 && (
                <div className="guide-section">
                  <h3 className="guide-section-title">Recently Played</h3>
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

              <div className="guide-section">
                <h3 className="guide-section-title">Active Tab</h3>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Current</span>
                  <span className="guide-stat-value guide-stat-highlight">{categories[activeCategory]}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="guide-tab-content">
              <div className="guide-section">
                <h3 className="guide-section-title">Quick Actions</h3>
                <button
                  className="guide-action-btn"
                  onMouseEnter={playHover}
                  onClick={playSelect}
                >
                  <span className="guide-action-icon">🎵</span>
                  <span>Open Music Player</span>
                </button>
                <button
                  className="guide-action-btn"
                  onMouseEnter={playHover}
                  onClick={playSelect}
                >
                  <span className="guide-action-icon">🎬</span>
                  <span>Open Video Player</span>
                </button>
              </div>
              <div className="guide-section">
                <h3 className="guide-section-title">Sound</h3>
                <div className="guide-volume-control">
                  <span className="guide-volume-label">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={muted ? 0 : volume}
                    onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
                    className="guide-volume-slider"
                  />
                  <button
                    className="guide-volume-mute"
                    onClick={() => setMuted(!muted)}
                  >
                    {muted ? '🔇' : volume > 50 ? '🔊' : volume > 0 ? '🔉' : '🔇'}
                  </button>
                </div>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Sound Effects</span>
                  <span className="guide-stat-value guide-stat-on">On</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="guide-tab-content">
              <div className="guide-section">
                <h3 className="guide-section-title">My Games ({allGames.length})</h3>
                {allGames.length === 0 ? (
                  <div className="guide-empty">No games added yet</div>
                ) : (
                  allGames.slice(0, 5).map(game => (
                    <div key={game.name} className="guide-list-item" onMouseEnter={playHover}>
                      <div className="guide-list-thumb">
                        <img src={game.icon} alt={game.name} />
                      </div>
                      <div className="guide-list-info">
                        <span className="guide-list-name">{game.name}</span>
                        <span className="guide-list-sub">
                          {'★'.repeat(game.stars || 0) + '☆'.repeat(5 - (game.stars || 0))}
                        </span>
                      </div>
                      {game.isPinned && <span className="guide-pinned-badge">📌</span>}
                    </div>
                  ))
                )}
                {allGames.length > 5 && (
                  <div className="guide-list-more">+{allGames.length - 5} more</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="guide-tab-content">
              <div className="guide-section">
                <h3 className="guide-section-title">System</h3>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Platform</span>
                  <span className="guide-stat-value">WinX360</span>
                </div>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Version</span>
                  <span className="guide-stat-value">1.0.0</span>
                </div>
                <div className="guide-stat-row">
                  <span className="guide-stat-label">Theme</span>
                  <span className="guide-stat-value">Metro</span>
                </div>
              </div>
              <div className="guide-section">
                <h3 className="guide-section-title">Settings</h3>
                <button
                  className="guide-action-btn"
                  onMouseEnter={playHover}
                  onClick={playSelect}
                >
                  <span className="guide-action-icon">⚙️</span>
                  <span>System Settings</span>
                </button>
                <button
                  className="guide-action-btn"
                  onMouseEnter={playHover}
                  onClick={playSelect}
                >
                  <span className="guide-action-icon">👤</span>
                  <span>Profile Settings</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Guide footer */}
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
            <span className="guide-shortcut-hint">Ctrl+Space to open</span>
            <span className="guide-shortcut-hint">Esc to close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
