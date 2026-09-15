import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '../context/ConfigContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

const tabs = [
  { id: 'home', label: 'Home', catIndex: 0 },
  { id: 'running', label: 'Running', catIndex: null },
  { id: 'media', label: 'Media', catIndex: 2 },
  { id: 'games', label: 'Games & Apps', catIndex: 3 },
  { id: 'settings', label: 'Settings', catIndex: 6 },
]

const subdomains = [
  { label: 'Ludaba', url: 'https://ludaba.panashe.co.za' },
  { label: 'Dashboard', url: 'https://dash.panashe.co.za' },
  { label: 'Games', url: 'https://games.panashe.co.za' },
  { label: 'Blog', url: 'https://blog.panashe.co.za' },
  { label: 'Desktop', url: 'https://desktop.panashe.co.za' },
]

function Clock() {
  const [time, setTime] = useState(new Date())
  useState(() => {
    const t = setInterval(() => setTime(new Date()), 30000)
    return () => clearInterval(t)
  })
  const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return <span className="g360-clock">{timeStr}</span>
}

export default function GuideMenu({ onClose, onNavigate, openApps, focusedAppId, onFocusApp, onCloseApp, onCloseAllApps }) {
  const { config } = useConfig()
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const allGames = config?.myGames || []
  const pinnedGames = allGames.filter(g => g.isPinned)
  const recentGames = [...allGames]
    .filter(g => g.lastPlayed)
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .slice(0, 6)

  const handleClose = useCallback(() => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }, [onClose])

  const playHover = () => {
    hoverAudio.currentTime = 0
    hoverAudio.play().catch(() => {})
  }

  const playSelect = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
  }

  const handleTabClick = (tab) => {
    playSelect()
    setActiveTab(tab.id)
    setSelectedIndex(0)
  }

  const handleNavItemClick = (item) => {
    playSelect()
    if (item.catIndex !== null && item.catIndex !== undefined) {
      onNavigate(item.catIndex)
    }
    onClose()
  }

  const handleSubdomainClick = (sub) => {
    playSelect()
    window.open(sub.url, '_blank')
    onClose()
  }

  const handleGameClick = (game) => {
    playSelect()
    if (game.url) {
      window.open(game.url, '_blank')
    }
    onClose()
  }

  const handleAppFocus = (app) => {
    playSelect()
    onFocusApp(app.id)
    onClose()
  }

  const handleCloseApp = (e, app) => {
    e.stopPropagation()
    playSelect()
    onCloseApp(app.id)
  }

  const handleCloseAll = () => {
    playSelect()
    onCloseAllApps()
    onClose()
  }

  const getTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="g360-list">
            {openApps.length > 0 && (
              <div className="g360-section-label">Running</div>
            )}
            {openApps.length > 0 && openApps.map((app, i) => (
              <div
                key={app.id}
                className={`g360-list-item ${i === selectedIndex ? 'g360-selected' : ''} ${app.id === focusedAppId ? 'g360-active-app' : ''}`}
                onMouseEnter={() => { setSelectedIndex(i); playHover() }}
                onClick={() => handleAppFocus(app)}
              >
                <div className="g360-item-icon">
                  {app.type === 'external' ? '🌐' : '📱'}
                </div>
                <span className="g360-item-name">{app.label || app.url || 'App'}</span>
                <div className="g360-item-dot"></div>
                <button className="g360-item-close" onClick={(e) => handleCloseApp(e, app)} onMouseEnter={playHover}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            {openApps.length === 0 && (
              <div className="g360-empty">No apps running</div>
            )}
            <div className="g360-section-label" style={{ marginTop: 12 }}>Navigate</div>
            {tabs.filter(t => t.catIndex !== null).map((tab, i) => (
              <div
                key={tab.id}
                className={`g360-list-item ${openApps.length + i === selectedIndex ? 'g360-selected' : ''}`}
                onMouseEnter={() => { setSelectedIndex(openApps.length + i); playHover() }}
                onClick={() => handleNavItemClick(tab)}
              >
                <span className="g360-item-name">{tab.label}</span>
                <span className="g360-item-arrow">›</span>
              </div>
            ))}
            {openApps.length > 0 && (
              <>
                <div className="g360-section-label" style={{ marginTop: 12 }}>System</div>
                <div
                  className="g360-list-item g360-quit-item"
                  onMouseEnter={() => { setSelectedIndex(openApps.length + tabs.length); playHover() }}
                  onClick={handleCloseAll}
                >
                  <span className="g360-item-name">Close All Apps</span>
                </div>
              </>
            )}
          </div>
        )

      case 'running':
        return (
          <div className="g360-list">
            {openApps.length > 0 && openApps.map((app, i) => (
              <div
                key={app.id}
                className={`g360-list-item ${i === selectedIndex ? 'g360-selected' : ''} ${app.id === focusedAppId ? 'g360-active-app' : ''}`}
                onMouseEnter={() => { setSelectedIndex(i); playHover() }}
                onClick={() => handleAppFocus(app)}
              >
                <div className="g360-item-icon">
                  {app.type === 'external' ? '🌐' : '📱'}
                </div>
                <span className="g360-item-name">{app.label || app.url || 'App'}</span>
                <div className="g360-item-dot"></div>
                <button className="g360-item-close" onClick={(e) => handleCloseApp(e, app)} onMouseEnter={playHover}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            {openApps.length === 0 && (
              <div className="g360-empty">No apps running</div>
            )}
            {openApps.length > 0 && (
              <div
                className="g360-list-item g360-quit-item"
                onMouseEnter={() => { setSelectedIndex(openApps.length); playHover() }}
                onClick={handleCloseAll}
              >
                <span className="g360-item-name">Close All Apps</span>
              </div>
            )}
          </div>
        )

      case 'media':
        return (
          <div className="g360-list">
            <div
              className={`g360-list-item ${0 === selectedIndex ? 'g360-selected' : ''}`}
              onMouseEnter={() => { setSelectedIndex(0); playHover() }}
              onClick={() => { playSelect(); onNavigate(2); onClose() }}
            >
              <span className="g360-item-name">Videos</span>
              <span className="g360-item-arrow">›</span>
            </div>
            <div
              className={`g360-list-item ${1 === selectedIndex ? 'g360-selected' : ''}`}
              onMouseEnter={() => { setSelectedIndex(1); playHover() }}
              onClick={() => { playSelect(); onNavigate(4); onClose() }}
            >
              <span className="g360-item-name">Music</span>
              <span className="g360-item-arrow">›</span>
            </div>
            {recentGames.length > 0 && (
              <>
                <div className="g360-section-label">Recent</div>
                {recentGames.map((game, i) => (
                  <div
                    key={game.name}
                    className={`g360-list-item ${2 + i === selectedIndex ? 'g360-selected' : ''}`}
                    onMouseEnter={() => { setSelectedIndex(2 + i); playHover() }}
                    onClick={() => handleGameClick(game)}
                  >
                    <div className="g360-item-thumb">
                      <img src={game.icon} alt={game.name} />
                    </div>
                    <span className="g360-item-name">{game.name}</span>
                    <span className="g360-item-stars">{'★'.repeat(game.stars || 0)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )

      case 'games':
        return (
          <div className="g360-list">
            <div
              className={`g360-list-item ${0 === selectedIndex ? 'g360-selected' : ''}`}
              onMouseEnter={() => { setSelectedIndex(0); playHover() }}
              onClick={() => { playSelect(); onNavigate(3); onClose() }}
            >
              <span className="g360-item-name">All Games</span>
              <span className="g360-item-arrow">›</span>
            </div>
            <div
              className={`g360-list-item ${1 === selectedIndex ? 'g360-selected' : ''}`}
              onMouseEnter={() => { setSelectedIndex(1); playHover() }}
              onClick={() => { playSelect(); onNavigate(5); onClose() }}
            >
              <span className="g360-item-name">Apps</span>
              <span className="g360-item-arrow">›</span>
            </div>
            {pinnedGames.length > 0 && (
              <>
                <div className="g360-section-label">Pinned</div>
                {pinnedGames.map((game, i) => (
                  <div
                    key={game.name}
                    className={`g360-list-item ${2 + i === selectedIndex ? 'g360-selected' : ''}`}
                    onMouseEnter={() => { setSelectedIndex(2 + i); playHover() }}
                    onClick={() => handleGameClick(game)}
                  >
                    <div className="g360-item-thumb">
                      <img src={game.icon} alt={game.name} />
                    </div>
                    <span className="g360-item-name">{game.name}</span>
                    <span className="g360-item-stars">{'★'.repeat(game.stars || 0)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="g360-section-label">Subdomains</div>
            {subdomains.map((sub, i) => (
              <div
                key={sub.label}
                className={`g360-list-item ${(pinnedGames.length + 3 + i) === selectedIndex ? 'g360-selected' : ''}`}
                onMouseEnter={() => { setSelectedIndex(pinnedGames.length + 3 + i); playHover() }}
                onClick={() => handleSubdomainClick(sub)}
              >
                <span className="g360-item-name">{sub.label}</span>
                <span className="g360-item-arrow">›</span>
              </div>
            ))}
          </div>
        )

      case 'settings':
        return (
          <div className="g360-list">
            {[
              { label: 'Profile', action: () => { onNavigate(6); onClose() } },
              { label: 'Preferences', action: () => { onNavigate(6); onClose() } },
              { label: 'System Settings', action: () => { onNavigate(6); onClose() } },
              { label: 'Account Management', action: () => { onNavigate(6); onClose() } },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`g360-list-item ${i === selectedIndex ? 'g360-selected' : ''}`}
                onMouseEnter={() => { setSelectedIndex(i); playHover() }}
                onClick={() => { playSelect(); item.action() }}
              >
                <span className="g360-item-name">{item.label}</span>
                <span className="g360-item-arrow">›</span>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return createPortal(
    <div className={`g360-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`g360-blade ${isClosing ? 'g360-blade-closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="g360-header">
          <div className="g360-header-left">
            <span className="g360-title">Guide</span>
          </div>
          <div className="g360-header-right">
            <div className="g360-profile">
              <div className="g360-avatar"></div>
              <div className="g360-profile-info">
                <span className="g360-gamertag">Player 1</span>
                <span className="g360-gamerscore">G 10450</span>
              </div>
            </div>
            <Clock />
          </div>
        </div>

        <div className="g360-body">
          <div className="g360-tabs">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`g360-tab ${activeTab === tab.id ? 'g360-tab-active' : ''}`}
                onMouseEnter={playHover}
                onClick={() => handleTabClick(tab)}
              >
                <span className="g360-tab-label">{tab.label}</span>
              </div>
            ))}
          </div>

          <div className="g360-content">
            {getTabContent()}
          </div>
        </div>

        <div className="g360-footer">
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-a">A</span>
            <span className="g360-prompt-text">Select</span>
          </div>
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-b">B</span>
            <span className="g360-prompt-text">Back</span>
          </div>
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-x">X</span>
            <span className="g360-prompt-text">Home</span>
          </div>
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-y">Y</span>
            <span className="g360-prompt-text">Dashboard</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
