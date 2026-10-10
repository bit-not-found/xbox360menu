import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playHoverSound } from '../../../navigation/hoverSound'
import { playSelectSound } from '../../../navigation/sound'

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

export default function MyAvatarScreen({ active }) {
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

  return (
    <div className="aw-avatar-screen">
      <div
        className={`aw-viewport ${dragOver ? 'aw-viewport-drag' : ''}`}
        ref={containerRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
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
          <div className="aw-overlay-panel aw-overlay-empty">
            <span className="aw-overlay-text">No avatar yet.</span>
            <span className="aw-overlay-sub">Import one from VRoid Studio → Export → VRM 1.0.</span>
          </div>
        )}
        {notice && !isBusy && <div className="aw-toast">{notice}</div>}
      </div>

      <aside className="aw-sidebar">
        <div className="aw-side-section">
          <div className="aw-side-title">Import</div>
          <button
            type="button"
            className="aw-action aw-action-primary"
            onClick={() => { playSelectSound(); fileInputRef.current?.click() }}
            onMouseEnter={playHoverSound}
          >
            Import .vrm
          </button>
          <p className="aw-side-hint">Drag a .vrm onto the viewport, or export from VRoid Studio (Export → VRM, VRM 1.0).</p>
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
        </div>

        <div className="aw-side-section">
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
        </div>

        <div className="aw-side-section">
          <div className="aw-side-title">Pose</div>
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
        </div>

        <div className="aw-side-section">
          <div className="aw-side-title">Expression</div>
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
        </div>

        <div className="aw-side-section">
          <div className="aw-side-title">Quality</div>
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
        </div>

        <div className="aw-side-section">
          <div className="aw-side-title">Storage</div>
          <StorageMeter storeRef={storeRef} active={active} />
        </div>
      </aside>
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

function StorageMeter({ storeRef, active }) {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    const store = storeRef.current
    if (!store) return undefined
    const load = () => {
      store.settings.getStorageUsage().then((value) => {
        if (!cancelled) setUsage(value)
      })
    }
    load()
    const timer = setInterval(load, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [storeRef, active])

  if (!usage) return <div className="aw-side-empty">Usage unavailable.</div>
  return (
    <div className="aw-storage">
      <span className="aw-storage-text">
        {formatBytes(usage.usage)} of {formatBytes(usage.quota)}
      </span>
      <span className="aw-storage-text">{usage.persisted ? 'Persistent' : 'Best effort'}</span>
    </div>
  )
}
