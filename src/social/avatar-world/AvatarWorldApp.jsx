import { useCallback, useEffect, useRef, useState } from 'react'
import { registerBackHandler, clearNavFocus } from '../../navigation/navEngine'
import { playHoverSound } from '../../navigation/hoverSound'
import { playSelectSound } from '../../navigation/sound'
import { CATEGORIES } from './hub/categories'
import { Person, Play, Rooms, Chats, Settings as SettingsIcon } from './hub/icons'
import MyAvatarScreen from './hub/MyAvatarScreen'
import AvatarSettings from './hub/AvatarSettings'

const SOCIAL_SECTIONS = [
  { id: 'play', label: 'Play', Icon: Play },
  { id: 'rooms', label: 'My Rooms', Icon: Rooms },
  { id: 'chats', label: 'Chats', Icon: Chats },
]

function ComingSoon({ title, body }) {
  return (
    <div className="aw-coming-soon">
      <div className="aw-coming-badge">Coming soon</div>
      <h2 className="aw-coming-title">{title}</h2>
      <p className="aw-coming-body">{body}</p>
    </div>
  )
}

export default function AvatarWorldApp({ onRequestMinimize, isWindowActive = true }) {
  const [view, setView] = useState('customize')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const rootRef = useRef(null)
  const minimizeRef = useRef(onRequestMinimize)
  const controlsRef = useRef(null)

  useEffect(() => {
    minimizeRef.current = onRequestMinimize
  }, [onRequestMinimize])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    return registerBackHandler(el, () => minimizeRef.current?.())
  }, [])

  const goToGrid = useCallback(() => {
    playSelectSound()
    setView('customize')
    setSelectedCategory(null)
    clearNavFocus()
  }, [])

  const selectCategory = useCallback((id) => {
    playSelectSound()
    setView('customize')
    setSelectedCategory(id)
    clearNavFocus()
  }, [])

  const showSection = useCallback((id) => {
    playSelectSound()
    setView(id)
    setSelectedCategory(null)
    clearNavFocus()
  }, [])

  const handleSave = () => {
    playSelectSound()
    controlsRef.current?.save?.()
  }

  const handleDiscard = () => {
    playSelectSound()
    controlsRef.current?.discard?.()
  }

  return (
    <div ref={rootRef} className="aw-root">
      <nav className="aw-rail" aria-label="Customize">
        <button
          type="button"
          className={`aw-rail-btn aw-rail-mark ${view === 'customize' && !selectedCategory ? 'aw-rail-active' : ''}`}
          title="Avatar"
          onClick={goToGrid}
          onMouseEnter={playHoverSound}
        >
          <Person size={24} />
        </button>

        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`aw-rail-btn ${view === 'customize' && selectedCategory === cat.id ? 'aw-rail-active' : ''}`}
            title={cat.label}
            onClick={() => selectCategory(cat.id)}
            onMouseEnter={playHoverSound}
          >
            <cat.Icon size={22} />
          </button>
        ))}

        <div className="aw-rail-spacer" />

        {SOCIAL_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`aw-rail-btn ${view === section.id ? 'aw-rail-active' : ''}`}
            title={section.label}
            onClick={() => showSection(section.id)}
            onMouseEnter={playHoverSound}
          >
            <section.Icon size={22} />
          </button>
        ))}

        <button
          type="button"
          className={`aw-rail-btn aw-rail-settings ${view === 'settings' ? 'aw-rail-active' : ''}`}
          title="Settings"
          onClick={() => showSection('settings')}
          onMouseEnter={playHoverSound}
        >
          <SettingsIcon size={22} />
        </button>
      </nav>

      <div className="aw-main">
        <header className="aw-topbar">
          <span className="aw-topbar-title">Avatar World</span>
          <div className="aw-topbar-actions">
            <button type="button" className="aw-topbar-btn" onClick={handleSave} onMouseEnter={playHoverSound}>
              Save
            </button>
            <button type="button" className="aw-topbar-btn" onClick={handleDiscard} onMouseEnter={playHoverSound}>
              Discard
            </button>
          </div>
        </header>

        <div className="aw-content">
          {view === 'customize' && (
            <MyAvatarScreen
              active={isWindowActive}
              selectedCategory={selectedCategory}
              onSelectCategory={selectCategory}
              onShowGrid={goToGrid}
              controlsRef={controlsRef}
            />
          )}

          {view === 'settings' && <AvatarSettings active />}

          {view === 'play' && (
            <ComingSoon
              title="Play"
              body="Jump into shared spaces and mini experiences with your avatar. This is where social play will live in a later phase."
            />
          )}
          {view === 'rooms' && (
            <ComingSoon title="My Rooms" body="Create and visit your own avatar rooms. Coming in a later phase." />
          )}
          {view === 'chats' && (
            <ComingSoon title="Chats" body="Message and voice chat with friends. Coming in a later phase." />
          )}
        </div>
      </div>
    </div>
  )
}
