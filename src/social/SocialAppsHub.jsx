import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerBackHandler, registerBumperHandler, clearNavFocus } from '../navigation/navEngine'
import { playHoverSound } from '../navigation/hoverSound'
import { playSelectSound, playBackSound } from '../navigation/sound'
import { SOCIAL_APPS, SOCIAL_APP_GROUPS, SOCIAL_BLADE_LABEL } from './registry'
import AvatarWorldApp from './avatar-world/AvatarWorldApp'

function buildRows() {
  const rows = []
  const indexById = new Map()
  let appIndex = 0
  for (const group of SOCIAL_APP_GROUPS) {
    const apps = SOCIAL_APPS.filter((app) => app.group === group.id)
    if (apps.length === 0) continue
    rows.push({ kind: 'label', key: `label-${group.id}`, label: group.label })
    for (const app of apps) {
      indexById.set(app.id, appIndex)
      appIndex += 1
      rows.push({ kind: 'app', key: app.id, app })
    }
  }
  return { rows, indexById, count: appIndex }
}

const HUB_ROWS = buildRows()

function buildAppDescriptor(entry) {
  return {
    id: `social-${entry.id}`,
    label: entry.title,
    url: `social://${entry.id}`,
    type: 'internal',
    component: entry.id === 'avatar-world' ? <AvatarWorldApp appId={entry.id} /> : null,
  }
}

export default function SocialAppsHub({ onClose, onOpenApp }) {
  const [isClosing, setIsClosing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const rootRef = useRef(null)
  const closeRef = useRef(null)

  const handleClose = useCallback(() => {
    playBackSound()
    setIsClosing(true)
    setTimeout(() => onClose(), 280)
  }, [onClose])

  useEffect(() => {
    closeRef.current = handleClose
  }, [handleClose])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    return registerBackHandler(el, () => closeRef.current())
  }, [])

  useEffect(() => {
    return registerBumperHandler((delta) => {
      setSelectedIndex((prev) => {
        const next = (prev + delta + HUB_ROWS.count) % HUB_ROWS.count
        playSelectSound()
        clearNavFocus()
        return next
      })
    })
  }, [])

  const handleLaunch = (entry, index) => {
    setSelectedIndex(index)
    if (!entry.available) return
    playSelectSound()
    onOpenApp(buildAppDescriptor(entry))
    onClose()
  }

  return createPortal(
    <div ref={rootRef} className={`g360-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`g360-blade ${isClosing ? 'g360-blade-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="g360-header">
          <div className="g360-header-left">
            <span className="g360-title">{SOCIAL_BLADE_LABEL}</span>
          </div>
          <div className="g360-header-right">
            <span className="g360-clock">Social</span>
          </div>
        </div>

        <div className="g360-content" style={{ paddingTop: 8 }}>
          <div className="g360-list">
            {HUB_ROWS.rows.map((row) => {
              if (row.kind === 'label') {
                return (
                  <div key={row.key} className="g360-section-label">
                    {row.label}
                  </div>
                )
              }
              const { app } = row
              const index = HUB_ROWS.indexById.get(app.id)
              return (
                <div
                  key={row.key}
                  className={`g360-list-item ${index === selectedIndex ? 'g360-selected' : ''} ${!app.available ? 'sa-item-disabled' : ''}`}
                  onMouseEnter={() => { setSelectedIndex(index); playHoverSound() }}
                  onClick={() => handleLaunch(app, index)}
                >
                  <div className="g360-item-thumb">
                    <img src={app.icon} alt="" />
                  </div>
                  <div className="sa-item-body">
                    <span className="g360-item-name">{app.title}</span>
                    <span className="sa-item-tagline">{app.tagline}</span>
                  </div>
                  {app.available ? (
                    <span className="g360-item-arrow">›</span>
                  ) : (
                    <span className="sa-item-badge">Soon</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="g360-footer">
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-a">A</span>
            <span className="g360-prompt-text">Open</span>
          </div>
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-b">B</span>
            <span className="g360-prompt-text">Back</span>
          </div>
          <div className="g360-prompt">
            <span className="g360-btn-icon g360-btn-x">LB</span>
            <span className="g360-prompt-text">Switch</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
