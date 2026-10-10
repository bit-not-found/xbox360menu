import { useCallback, useEffect, useRef, useState } from 'react'
import { registerBackHandler, registerBumperHandler, clearNavFocus } from '../../navigation/navEngine'
import { playHoverSound } from '../../navigation/hoverSound'
import { playSelectSound } from '../../navigation/sound'
import MyAvatarScreen from './hub/MyAvatarScreen'
import AvatarSettings from './hub/AvatarSettings'

const TABS = [
  { id: 'play', label: 'Play' },
  { id: 'avatar', label: 'My Avatar' },
  { id: 'rooms', label: 'My Rooms' },
  { id: 'chats', label: 'Chats' },
  { id: 'settings', label: 'Settings' },
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
  const [activeTab, setActiveTab] = useState('avatar')
  const rootRef = useRef(null)
  const activeTabRef = useRef(activeTab)
  const minimizeRef = useRef(onRequestMinimize)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    minimizeRef.current = onRequestMinimize
  }, [onRequestMinimize])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    return registerBackHandler(el, () => minimizeRef.current?.())
  }, [])

  useEffect(() => {
    return registerBumperHandler((delta) => {
      const idx = TABS.findIndex((tab) => tab.id === activeTabRef.current)
      const next = (idx + delta + TABS.length) % TABS.length
      playSelectSound()
      setActiveTab(TABS[next].id)
      clearNavFocus()
    })
  }, [])

  const handleTabClick = useCallback((id) => {
    playSelectSound()
    setActiveTab(id)
    clearNavFocus()
  }, [])

  return (
    <div ref={rootRef} className="aw-root">
      <div className="aw-tab-rail">
        <div className="aw-brand">Avatar World</div>
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={`aw-tab ${activeTab === tab.id ? 'aw-tab-active' : ''}`}
            onMouseEnter={playHoverSound}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="aw-tab-label">{tab.label}</span>
          </div>
        ))}
        <div className="aw-rail-spacer" />
        <div className="aw-rail-hint">LB / RB to switch</div>
      </div>

      <div className="aw-stage">
        <div className={`aw-pane ${activeTab === 'avatar' ? 'aw-pane-active' : ''}`}>
          <MyAvatarScreen active={activeTab === 'avatar' && isWindowActive} />
        </div>
        {activeTab === 'play' && (
          <div className="aw-pane aw-pane-active">
            <ComingSoon
              title="Play"
              body="Jump into shared spaces and mini experiences with your avatar. This is where social play will live in a later phase."
            />
          </div>
        )}
        {activeTab === 'rooms' && (
          <div className="aw-pane aw-pane-active">
            <ComingSoon title="My Rooms" body="Create and visit your own avatar rooms. Coming in a later phase." />
          </div>
        )}
        {activeTab === 'chats' && (
          <div className="aw-pane aw-pane-active">
            <ComingSoon title="Chats" body="Message and voice chat with friends. Coming in a later phase." />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="aw-pane aw-pane-active">
            <AvatarSettings active={activeTab === 'settings'} />
          </div>
        )}
      </div>
    </div>
  )
}
