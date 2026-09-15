const hoverAudio = new Audio('./assets/audio/hover.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

export default function Taskbar({ apps, focusedAppId, onFocusApp, onCloseApp }) {
  const playHover = () => {
    hoverAudio.currentTime = 0
    hoverAudio.play().catch(() => {})
  }

  const playSelect = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
  }

  if (apps.length === 0) return null

  return (
    <div className="taskbar">
      <div className="taskbar-label">Open</div>
      <div className="taskbar-apps">
        {apps.map(app => (
          <div
            key={app.id}
            className={`taskbar-app ${app.id === focusedAppId ? 'taskbar-app-focused' : ''}`}
            onMouseEnter={playHover}
            onClick={() => { playSelect(); onFocusApp(app.id) }}
          >
            <div className="taskbar-app-indicator"></div>
            <span className="taskbar-app-name">{app.label || app.url || 'App'}</span>
            <button
              className="taskbar-app-close"
              onClick={(e) => { e.stopPropagation(); playSelect(); onCloseApp(app.id) }}
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
