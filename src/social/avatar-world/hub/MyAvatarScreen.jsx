import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playHoverSound } from '../../../navigation/hoverSound'
import { playSelectSound } from '../../../navigation/sound'
import { CATEGORIES, getCategory } from './categories'
import { Import, Back } from './icons'

const EXPRESSION_NAMES = ['happy', 'sad', 'angry', 'surprised', 'relaxed']
const QUALITY_PROFILES = ['full', 'lite']
const HARD_CAP = 100 * 1024 * 1024

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

export default function MyAvatarScreen({ active, selectedCategory, onSelectCategory, onShowGrid, controlsRef }) {
  const containerRef = useRef(null)
  const handleRef = useRef(null)
  const moduleRef = useRef(null)
  const storeRef = useRef(null)
  const fileInputRef = useRef(null)
  const noticeTimer = useRef(null)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [avatars, setAvatars] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [expressions, setExpressions] = useState({})
  const [quality, setQuality] = useState('full')
  const [dragOver, setDragOver] = useState(false)
  const [notice, setNotice] = useState('')

  const qualityRef = useRef(quality)
  useEffect(() => {
    qualityRef.current = quality
  }, [quality])

  const showNotice = useCallback((message) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 3200)
  }, [])

  const refreshAvatars = useCallback(async () => {
    const store = storeRef.current
    if (!store) return
    const list = await store.avatars.listAvatars()
    setAvatars(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    let booted = null

    async function boot() {
      const [mod, avatarsStore, settingsStore, optimizerMod] = await Promise.all([
        import('../index'),
        import('../store/avatars'),
        import('../store/settings'),
        import('../avatar/Optimizer'),
      ])
      if (cancelled || !containerRef.current) return

      moduleRef.current = mod
      storeRef.current = { avatars: avatarsStore, settings: settingsStore, optimizer: optimizerMod }

      const savedProfile = (await settingsStore.getQualityProfile()) ?? 'full'
      if (!cancelled) setQuality(savedProfile)

      booted = await mod.mount(containerRef.current, {
        quality: savedProfile,
        usePlaceholder: false,
        onStatus: (next, detail) => {
          if (cancelled) return
          setStatus(next)
          if (next === 'error') setError(detail || 'Failed to load avatar.')
        },
        onError: (err) => {
          if (!cancelled) setError(err.message)
        },
      })
      if (cancelled) {
        mod.unmount(booted)
        return
      }
      handleRef.current = booted

      const activeRecord = await avatarsStore.getActiveAvatar()
      if (cancelled) return
      if (activeRecord) {
        try {
          await booted.load(activeRecord.blob)
          setActiveId(activeRecord.id)
        } catch {
          await booted.loadPlaceholder()
        }
      } else {
        await booted.loadPlaceholder()
      }
      if (!cancelled) await refreshAvatars()
    }

    boot().catch((err) => {
      if (!cancelled) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to start the 3D engine.')
      }
    })

    return () => {
      cancelled = true
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
      const handle = handleRef.current
      handleRef.current = null
      if (handle) moduleRef.current?.unmount(handle)
    }
  }, [refreshAvatars])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    if (active) {
      handle.engine.loop.resume()
    } else {
      handle.engine.loop.pause()
    }
  }, [active, status])

  // Expose Save / Discard to the top action bar.
  useEffect(() => {
    if (!controlsRef) return undefined
    controlsRef.current = {
      save: async () => {
        await storeRef.current?.settings.requestPersistentStorage()
        showNotice('Saved')
      },
      discard: () => {
        handleRef.current?.resetExpressions()
        setExpressions({})
        showNotice('Reset')
      },
    }
    return () => {
      controlsRef.current = null
    }
  }, [controlsRef, showNotice])

  const applyLoaded = useCallback(async (record) => {
    const handle = handleRef.current
    const store = storeRef.current
    if (!handle || !store) return
    setStatus('loading')
    setError('')
    try {
      await handle.load(record.blob)
      await store.avatars.setActiveAvatar(record.id)
      setActiveId(record.id)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar.')
      setStatus('error')
    }
  }, [])

  const importFile = useCallback(async (file) => {
    if (!file) return
    const handle = handleRef.current
    const store = storeRef.current
    if (!handle || !store) return
    if (!/\.vrm$/i.test(file.name)) {
      setError('Please choose a .vrm file exported from VRoid Studio.')
      setStatus('error')
      return
    }
    if (file.size > HARD_CAP) {
      setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(HARD_CAP)}.`)
      setStatus('error')
      return
    }

    setStatus('loading')
    setError('')
    setProgress(0)
    try {
      const result = await store.optimizer.optimizeVrm(file, {
        profile: qualityRef.current,
        onProgress: (value) => setProgress(Math.round(value * 100)),
      })
      const blob = new Blob([result.buffer], { type: 'model/gltf-binary' })
      await handle.load(blob)
      const thumbnail = await handle.captureThumbnail(320, 320)
      const saved = await store.avatars.saveAvatar({
        name: file.name.replace(/\.vrm$/i, ''),
        blob,
        thumbnail: thumbnail ?? undefined,
        profile: qualityRef.current,
      })
      await store.avatars.setActiveAvatar(saved.record.id)
      setActiveId(saved.record.id)
      await refreshAvatars()
      await store.settings.requestPersistentStorage()
      showNotice(
        result.changed
          ? `Saved · ${formatBytes(result.originalSize)} → ${formatBytes(result.optimizedSize)}`
          : `Saved · ${formatBytes(result.originalSize)}`,
      )
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setStatus('error')
    } finally {
      setProgress(0)
    }
  }, [refreshAvatars, showNotice])

  const handleDelete = useCallback(async (event, record) => {
    event.stopPropagation()
    const store = storeRef.current
    const handle = handleRef.current
    if (!store) return
    playSelectSound()
    await store.avatars.deleteAvatar(record.id)
    const list = await store.avatars.listAvatars()
    setAvatars(list)
    if (activeId === record.id) {
      setActiveId(null)
      if (handle) await handle.loadPlaceholder()
    }
  }, [activeId])

  const toggleExpression = useCallback((name) => {
    playSelectSound()
    setExpressions((prev) => {
      const next = !prev[name]
      handleRef.current?.setExpression(name, next ? 1 : 0)
      return { ...prev, [name]: next }
    })
  }, [])

  const handlePose = useCallback((name) => {
    playSelectSound()
    handleRef.current?.setPose(name)
  }, [])

  const handleQuality = useCallback((profile) => {
    playSelectSound()
    setQuality(profile)
    handleRef.current?.setQuality(profile)
    storeRef.current?.settings.setQualityProfile(profile)
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) importFile(file)
  }, [importFile])

  const isBusy = status === 'loading'
  const category = selectedCategory ? getCategory(selectedCategory) : null

  const renderDetail = (id) => {
    if (id === 'dressup') {
      return (
        <>
          <button
            type="button"
            className="aw-action aw-action-primary aw-detail-import"
            onClick={() => { playSelectSound(); fileInputRef.current?.click() }}
            onMouseEnter={playHoverSound}
          >
            <Import size={18} />
            <span>Import .vrm</span>
          </button>
          <p className="aw-side-hint">
            Drag a .vrm onto the avatar, or export from VRoid Studio (Export → VRM, VRM 1.0).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vrm"
            className="aw-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) importFile(file)
            }}
          />

          <div className="aw-side-title">Saved Avatars</div>
          {avatars.length === 0 && <div className="aw-side-empty">Nothing saved yet.</div>}
          <div className="aw-avatar-list">
            {avatars.map((record) => (
              <div
                key={record.id}
                className={`aw-avatar-item ${record.id === activeId ? 'aw-avatar-active' : ''}`}
                onMouseEnter={playHoverSound}
                onClick={() => applyLoaded(record)}
              >
                <Thumbnail blob={record.thumbnail} />
                <div className="aw-avatar-meta">
                  <span className="aw-avatar-name">{record.name}</span>
                  <span className="aw-avatar-size">{formatBytes(record.size)}</span>
                </div>
                <button
                  type="button"
                  className="aw-avatar-delete"
                  title="Delete"
                  onClick={(e) => handleDelete(e, record)}
                  onMouseEnter={playHoverSound}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (id === 'expressions') {
      return (
        <div className="aw-chip-row">
          {EXPRESSION_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`aw-chip ${expressions[name] ? 'aw-chip-active' : ''}`}
              onClick={() => toggleExpression(name)}
              onMouseEnter={playHoverSound}
            >
              {name}
            </button>
          ))}
        </div>
      )
    }

    if (id === 'poses') {
      return (
        <div className="aw-chip-row">
          <button
            type="button"
            className="aw-chip aw-chip-active"
            onClick={() => handlePose('idle')}
            onMouseEnter={playHoverSound}
          >
            Idle
          </button>
        </div>
      )
    }

    if (id === 'quality') {
      return (
        <div className="aw-chip-row">
          {QUALITY_PROFILES.map((profile) => (
            <button
              key={profile}
              type="button"
              className={`aw-chip ${quality === profile ? 'aw-chip-active' : ''}`}
              onClick={() => handleQuality(profile)}
              onMouseEnter={playHoverSound}
            >
              {profile === 'full' ? 'Full' : 'Lite'}
            </button>
          ))}
        </div>
      )
    }

    return <p className="aw-side-hint">Coming soon. This style isn’t customizable yet.</p>
  }

  return (
    <div className="aw-customize">
      <section className="aw-panel">
        {!category ? (
          <>
            <div className="aw-panel-head">
              <h2 className="aw-panel-title">Customize</h2>
              <span className="aw-panel-sub">Pick a category</span>
            </div>
            <div className="aw-grid">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="aw-cat-card"
                  onClick={() => onSelectCategory(c.id)}
                  onMouseEnter={playHoverSound}
                >
                  <span className="aw-cat-icon">
                    <c.Icon size={26} />
                  </span>
                  <span className="aw-cat-label">{c.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="aw-detail">
            <button type="button" className="aw-detail-back" onClick={onShowGrid} onMouseEnter={playHoverSound}>
              <Back size={16} />
              <span>All categories</span>
            </button>
            <div className="aw-detail-head">
              <span className="aw-detail-icon">
                <category.Icon size={22} />
              </span>
              <h2 className="aw-panel-title">{category.label}</h2>
            </div>
            {renderDetail(category.id)}
          </div>
        )}
      </section>

      <div
        className={`aw-stage ${dragOver ? 'aw-stage-drag' : ''}`}
        ref={containerRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="aw-floor" />
        {isBusy && (
          <div className="aw-overlay-panel">
            <div className="aw-spinner" />
            <span className="aw-overlay-text">
              {progress > 0 ? `Optimizing… ${progress}%` : 'Loading avatar…'}
            </span>
          </div>
        )}
        {!isBusy && status === 'error' && (
          <div className="aw-overlay-panel aw-overlay-error">
            <span className="aw-overlay-text">{error}</span>
          </div>
        )}
        {!isBusy && status !== 'error' && avatars.length === 0 && (
          <div className="aw-overlay-panel">
            <span className="aw-overlay-text">No avatar yet.</span>
            <span className="aw-overlay-sub">Import one from VRoid Studio → Export → VRM 1.0.</span>
          </div>
        )}
        {notice && !isBusy && <div className="aw-toast">{notice}</div>}
      </div>
    </div>
  )
}

function Thumbnail({ blob }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob])

  useEffect(() => {
    if (!url) return undefined
    return () => URL.revokeObjectURL(url)
  }, [url])

  if (!url) return <div className="aw-avatar-thumb aw-avatar-thumb-empty" />
  return <img className="aw-avatar-thumb" src={url} alt="" />
}
