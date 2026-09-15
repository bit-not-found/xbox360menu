import { useState, useEffect, useCallback } from 'react'
import { getIpcRenderer } from './utils/electron'
import Tile from './components/Tile'
import IntroVideo from './components/IntroVideo'
import HomePage from './components/HomePage'
import SocialPage from './components/SocialPage'
import VideoPage from './components/VideoPage'
import GamesPage from './components/GamesPage'
import MusicPage from './components/MusicPage'
import AppsPage from './components/AppsPage'
import AppWindow from './components/AppWindow'
import GuideMenu from './components/GuideMenu'
import Taskbar from './components/Taskbar'
import './App.css'
import { ConfigProvider } from './context/ConfigContext'

const categories = ['home', 'social', 'media', 'games', 'music', 'apps', 'settings']
const settingsTiles = [
  { label: 'System', icon: <img src="./assets/icons/system.png" alt="System" /> },
  { label: 'Preferences', icon: <img src="./assets/icons/Preferences.png" alt="Preferences" /> },
  { label: 'Profile', icon: <img src="./assets/icons/profile_settings.png" alt="Profile" /> },
  { label: 'Kinect', icon: <img src="./assets/icons/kinect_device.png" alt="Kinect" />, disabled: true },
  { label: 'Account', icon: <img src="./assets/icons/account.png" alt="Account" /> },
  { label: 'Privacy', icon: <img src="./assets/icons/Privacy.png" alt="Privacy" /> },
  { label: 'Family', icon: <img src="./assets/icons/Family.png" alt="Family" /> },
  { label: 'Turn Off', icon: <img src="./assets/icons/TurnOff.png" alt="Turn Off" />, onClick: () => { const ipc = getIpcRenderer(); if (ipc) ipc.send('app:quit') } },
]

const pageLeftAudio = new Audio('./assets/audio/Page Left.mp3')
const pageRightAudio = new Audio('./assets/audio/Page Right.mp3')
let appIdCounter = 0

function App() {
  const [activeCategory, setActiveCategory] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const [isSliding, setIsSliding] = useState(false)
  const [entranceAnimation, setEntranceAnimation] = useState(false)
  const [openApps, setOpenApps] = useState([])
  const [focusedAppId, setFocusedAppId] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  const finishIntro = () => {
    setShowIntro(false)
    setEntranceAnimation(true)
  }

  const handleCategoryChange = (index) => {
    if (index === activeCategory) return
    if (index > activeCategory) {
      pageRightAudio.currentTime = 0
      pageRightAudio.play().catch(() => {})
    } else {
      pageLeftAudio.currentTime = 0
      pageLeftAudio.play().catch(() => {})
    }
    setActiveCategory(index)
    setIsSliding(true)
    setTimeout(() => setIsSliding(false), 500)
  }

  const openApp = useCallback((app) => {
    const existing = openApps.find(a => {
      if (app.type === 'emulator' && a.type === 'emulator') return a.label === app.label
      return a.url === app.url
    })
    if (existing) {
      setFocusedAppId(existing.id)
    } else {
      const id = ++appIdCounter
      setOpenApps(prev => [...prev, { ...app, id }])
      setFocusedAppId(id)
    }
    setShowGuide(false)
  }, [openApps])

  const focusApp = useCallback((id) => {
    setFocusedAppId(id)
    setShowGuide(false)
  }, [])

  const minimizeApp = useCallback(() => {
    setFocusedAppId(null)
  }, [])

  const closeApp = useCallback((id) => {
    setOpenApps(prev => prev.filter(a => a.id !== id))
    setFocusedAppId(prev => prev === id ? null : prev)
  }, [])

  const closeAllApps = useCallback(() => {
    setOpenApps([])
    setFocusedAppId(null)
    setActiveCategory(0)
  }, [])

  const toggleGuide = useCallback(() => {
    setShowGuide(prev => !prev)
  }, [])

  const closeGuide = useCallback(() => {
    setShowGuide(false)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === ' ' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        toggleGuide()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showGuide) {
          closeGuide()
        } else if (focusedAppId) {
          minimizeApp()
        } else {
          toggleGuide()
        }
      }
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (showGuide && focusedAppId) {
          closeApp(focusedAppId)
          closeGuide()
        }
      }
      if ((e.key === 'y' || e.key === 'Y') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (showGuide) {
          closeAllApps()
          closeGuide()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [toggleGuide, closeGuide, minimizeApp, closeApp, closeAllApps, showGuide, focusedAppId])

  return (
    <div className={`dashboard ${isSliding ? 'sliding' : ''} ${entranceAnimation ? 'animate-entrance' : ''}`}>
      {showIntro && <IntroVideo onFinished={finishIntro} />}

      <div className="background-layer" style={{ backgroundImage: `url('./assets/bg.png')` }}></div>

      <header className="header">
        <div className="nav-menu">
          {categories.map((cat, index) => (
            <div
              key={cat}
              className={`nav-item ${index === activeCategory ? 'active' : ''}`}
              onClick={() => handleCategoryChange(index)}
            >
              {cat}
            </div>
          ))}
        </div>
      </header>

      <main className="main-content">
        <div
          className="pages-container"
          style={{ transform: `translateX(calc(7.5vw - ${activeCategory * 85}vw))` }}
        >
          {categories.map((cat, index) => (
            <section key={cat} className={`page ${index !== activeCategory ? 'inactive' : ''}`}>
              {cat === 'home' ? (
                <HomePage onOpenApp={openApp} isActive={index === activeCategory} />
              ) : cat === 'social' ? (
                <SocialPage />
              ) : cat === 'media' ? (
                <VideoPage isActive={index === activeCategory} />
              ) : cat === 'games' ? (
                <GamesPage onOpenApp={openApp} isActive={index === activeCategory} />
              ) : cat === 'music' ? (
                <MusicPage />
              ) : cat === 'apps' ? (
                <AppsPage />
              ) : cat === 'settings' ? (
                <div className="settings-grid">
                  {settingsTiles.map((tile) => (
                    <Tile key={tile.label} label={tile.label} icon={tile.icon} disabled={tile.disabled} onClick={tile.onClick} />
                  ))}
                </div>
              ) : (
                <div className="tiles-grid">
                  <Tile size="large" />
                  <Tile size="medium" />
                  <Tile size="medium" />
                  <Tile size="small" />
                  <Tile size="small" />
                  <Tile size="small" />
                  <Tile size="small" />
                </div>
              )}
            </section>
          ))}
        </div>
      </main>

      {openApps.map(app => (
        <AppWindow
          key={app.id}
          app={app}
          minimized={app.id !== focusedAppId}
          onClose={() => closeApp(app.id)}
          onMinimize={minimizeApp}
        />
      ))}

      {openApps.length > 0 && (
        <Taskbar
          apps={openApps}
          focusedAppId={focusedAppId}
          onFocusApp={focusApp}
          onCloseApp={closeApp}
        />
      )}

      {showGuide && (
        <GuideMenu
          onClose={closeGuide}
          onNavigate={handleCategoryChange}
          openApps={openApps}
          focusedAppId={focusedAppId}
          onFocusApp={focusApp}
          onCloseApp={closeApp}
          onCloseAllApps={closeAllApps}
        />
      )}
    </div>
  )
}

export default function AppWrapper() {
  return (
    <ConfigProvider>
      <App />
    </ConfigProvider>
  )
}
