import { useEffect, useState } from 'react'
import { playHoverSound } from '../../../navigation/hoverSound'

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit <= 1 ? 0 : 1)} ${units[unit]}`
}

export default function AvatarSettings({ active }) {
  const [settings, setSettings] = useState(null)
  const [usage, setUsage] = useState(null)
  const [profile, setProfile] = useState('full')

  useEffect(() => {
    let cancelled = false
    import('../store/settings').then((mod) => {
      if (cancelled) return
      setSettings(mod)
      mod.getStorageUsage().then((value) => {
        if (!cancelled) setUsage(value)
      })
      mod.getQualityProfile().then((value) => {
        if (!cancelled) setProfile(value ?? 'full')
      })
    })
    return () => {
      cancelled = true
    }
  }, [active])

  const persist = async () => {
    playHoverSound()
    if (!settings) return
    await settings.requestPersistentStorage()
    const value = await settings.getStorageUsage()
    setUsage(value)
  }

  const changeProfile = async (next) => {
    playHoverSound()
    setProfile(next)
    if (settings) await settings.setQualityProfile(next)
  }

  return (
    <div className="aw-settings">
      <h2 className="aw-settings-title">Settings</h2>

      <section className="aw-settings-section">
        <h3>Avatar quality</h3>
        <p className="aw-settings-desc">Lite lowers resolution and turns off shadows — useful on low-power devices.</p>
        <div className="aw-chip-row">
          {['full', 'lite'].map((option) => (
            <button
              key={option}
              type="button"
              className={`aw-chip ${profile === option ? 'aw-chip-active' : ''}`}
              onClick={() => changeProfile(option)}
              onMouseEnter={playHoverSound}
            >
              {option === 'full' ? 'Full' : 'Lite'}
            </button>
          ))}
        </div>
      </section>

      <section className="aw-settings-section">
        <h3>Storage</h3>
        <p className="aw-settings-desc">
          {usage
            ? `${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} used · ${usage.persisted ? 'persistent' : 'best effort'}`
            : 'Usage unavailable.'}
        </p>
        <button type="button" className="aw-action" onClick={persist} onMouseEnter={playHoverSound}>
          Request persistent storage
        </button>
      </section>

      <section className="aw-settings-section">
        <h3>How to import from VRoid Studio</h3>
        <ol className="aw-settings-list">
          <li>Open your model in VRoid Studio.</li>
          <li>Choose Export → VRM.</li>
          <li>Select VRM 1.0 and save the .vrm file.</li>
          <li>Import it from the My Avatar tab.</li>
        </ol>
      </section>
    </div>
  )
}
