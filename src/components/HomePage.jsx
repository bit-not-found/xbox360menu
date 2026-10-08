import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import CollectionPage from './CollectionPage'
import SlideshowTile from './SlideshowTile'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getNodeFs } from '../utils/electron'
import { loadRomFile } from '../utils/romCache'
import { useFavorites, setFavorite } from '../utils/favorites'
import { useLibrary } from '../utils/library'
import { PLACEHOLDER_ART, handleArtworkError } from '../utils/artwork'

const PINS_SORT_OPTIONS = [
  { id: 'newest', label: 'Recently pinned' },
  { id: 'oldest', label: 'Oldest pinned' },
  { id: 'type', label: 'Type' },
  { id: 'name', label: 'Name A-Z' },
]

const SYSTEM_CORE_MAP = {
  nes: 'fceumm', sfc: 'snes9x', smc: 'snes9x', gba: 'mgba', gb: 'mgba', gbc: 'mgba',
  gen: 'genesis_plus_gx', md: 'genesis_plus_gx', sms: 'genesis_plus_gx', gg: 'genesis_plus_gx',
  pce: 'mednafen_pce', ngp: 'meowatch', ngpc: 'meowatch',
  ws: 'mednafen_wswan', wsc: 'mednafen_wswan', lnx: 'handy', jag: 'virtualjaguar',
  vb: 'mednafen_vb', col: 'col'
}

const SYSTEM_NAMES = {
  nes: 'NES', sfc: 'SNES', smc: 'SNES', gba: 'GBA', gb: 'Game Boy',
  gbc: 'Game Boy Color', gen: 'Genesis', md: 'Genesis', sms: 'Master System',
  gg: 'Game Gear', pce: 'PC Engine', ngp: 'Neo Geo Pocket', ngpc: 'Neo Geo Pocket Color',
  ws: 'WonderSwan', wsc: 'WonderSwan Color', lnx: 'Lynx', jag: 'Jaguar',
  vb: 'Virtual Boy', col: 'ColecoVision'
}

function detectSystem(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return { ext, system: SYSTEM_CORE_MAP[ext] || 'fceumm', systemName: SYSTEM_NAMES[ext] || ext.toUpperCase() }
}

const subdomains = [
  { id: 'ludaba', label: 'Ludaba', url: 'https://ludaba.panashe.co.za', icon: './assets/icons/controller.png' },
  { id: 'dash', label: 'Dashboard', url: 'https://dash.panashe.co.za', icon: './assets/icons/system.png' },
  { id: 'games', label: 'Games', url: 'https://games.panashe.co.za', icon: './assets/icons/controller.png' },
  { id: 'blog', label: 'Blog', url: 'https://blog.panashe.co.za', icon: './assets/icons/pin.png' },
  { id: 'desktop', label: 'Desktop', url: 'https://desktop.panashe.co.za', icon: './assets/icons/Preferences.png' },
]

export default function HomePage({ onOpenApp, isActive }) {
  const { config, updateConfig } = useConfig()
  const allGames = useMemo(() => config.myGames || [], [config.myGames])
  const allRoms = useMemo(() => config.myRoms || [], [config.myRoms])
  const tilesConfig = config.homeTiles || {}

  const setTilesConfig = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('homeTiles', newVal(tilesConfig))
    } else {
      updateConfig('homeTiles', newVal)
    }
  }

  const [showListModal, setShowListModal] = useState(false)
  const [listModalType, setListModalType] = useState('') // 'pins' or 'recent'

  const [editingTileId, setEditingTileId] = useState(null)
  const [editImgPath, setEditImgPath] = useState('')
  const [editAppPath, setEditAppPath] = useState('')
  const romInputRef = useRef(null)

  const handleContextMenu = (e, tileId) => {
    e.preventDefault()
    if (['c1-r1', 'c1-r2', 'c1-r3'].includes(tileId)) return
    setEditingTileId(tileId)
    const config = tilesConfig[tileId] || {}
    setEditImgPath(config.bg || '')
    setEditAppPath(config.app || '')
  }

  const handleSaveTile = () => {
    setTilesConfig(prev => ({
      ...prev,
      [editingTileId]: {
        bg: editImgPath,
        app: editAppPath
      }
    }))
    setEditingTileId(null)
  }

  const handleOpenApp = (tileId) => {
    if (tileId === 'c1-r1') {
      romInputRef.current?.click()
      return
    }
    if (tileId === 'c1-r2') {
      setListModalType('pins')
      setShowListModal(true)
      return
    }
    if (tileId === 'c1-r3') {
      setListModalType('recent')
      setShowListModal(true)
      return
    }

    const tileConfig = tilesConfig[tileId]
    if (!tileConfig || !tileConfig.app) return
    
    const appPath = tileConfig.app.trim()
    if (appPath.toLowerCase().startsWith('http://') || appPath.toLowerCase().startsWith('https://')) {
      if (onOpenApp) {
        onOpenApp({ type: 'external', url: appPath, label: tileId })
      } else {
        window.open(appPath, '_blank')
      }
    } else if (isElectron()) {
      try {
        const { exec } = window.require('child_process')
        const path = window.require('path')
        const cwd = path.dirname(appPath)
        exec(`start "" "${appPath}"`, { cwd }, (err) => {
          if (err) console.error('Failed to launch:', err)
        })
      } catch(e) {
        console.error('Failed to launch:', e)
      }
    }
  }

  const launchGameFromHome = (game) => {
    if (game.exe && isElectron()) {
      try {
        const { exec } = window.require('child_process')
        const path = window.require('path')
        const cwd = path.dirname(game.exe)
        exec(`start "" "${game.exe}"`, { cwd }, (err) => {
          if (err) console.error('Failed to launch:', err)
        })

        const updatedGames = allGames.map(g => g.name === game.name ? { ...g, lastPlayed: Date.now() } : g)
        updateConfig('myGames', updatedGames)
      } catch (err) {
        console.error('Failed to launch game:', err)
      }
    }
  }

  const launchRomFromHome = async (rom) => {
    const fileName = `${rom.name}.${rom.ext}`
    let romData = null

    try {
      const cachedFile = await loadRomFile(fileName)
      if (cachedFile) romData = cachedFile instanceof Blob ? cachedFile : new Blob([cachedFile])
    } catch (e) {
      console.warn('Failed to load ROM from cache:', e)
    }

    if (!romData && rom.path) {
      try {
        const fs = getNodeFs()
        if (fs && fs.promises && fs.promises.readFile) {
          romData = new Blob([await fs.promises.readFile(rom.path)])
        } else if (fs && fs.readFileSync) {
          romData = new Blob([fs.readFileSync(rom.path)])
        }
      } catch (e) {
        console.error('Failed to read ROM file from disk:', e)
      }
    }

    if (!romData) {
      alert('ROM file not available. Please re-add this ROM using the Add Game button.')
      return
    }

    if (onOpenApp) {
      onOpenApp({
        type: 'emulator',
        rom: romData,
        fileName,
        core: rom.core || 'fceumm',
        label: rom.name,
        systemName: rom.systemName
      })
    }
  }

  const playSlideGame = (item) => {
    if (!item) return
    if (item.isRom) {
      launchRomFromHome(item.romData || item)
    } else {
      launchGameFromHome(item)
    }
  }

const openExternal = (url, label) => {
    if (!url) return
    const lower = url.toLowerCase()
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      if (onOpenApp) {
        onOpenApp({ type: 'external', url, label })
      } else {
        window.open(url, '_blank')
      }
      return
    }
    if (isElectron()) {
      try {
        const { exec } = window.require('child_process')
        const path = window.require('path')
        exec(`start "" "${url}"`, { cwd: path.dirname(url) }, (err) => {
          if (err) console.error('Failed to launch:', err)
        })
      } catch (err) {
        console.error('Failed to launch:', err)
      }
    }
  }

  const favorites = useFavorites()
  const library = useLibrary()

  const pinsItems = useMemo(() => {
    const favIds = new Set(favorites.map(entry => entry.id))
    const favAt = new Map(favorites.map(entry => [entry.id, entry.at]))
    const musicFavorites = config.musicFavorites || []
    const customMusicCovers = config.customMusicCovers || {}
    const items = []

    allGames.forEach(game => {
      const id = game.name
      if (!favIds.has(id) && !game.isPinned) return
      items.push({
        id,
        name: game.name,
        icon: game.banner || game.icon || PLACEHOLDER_ART,
        kind: 'game',
        kindLabel: 'Game',
        isPinned: game.isPinned,
        mtime: favAt.get(id) || game.lastPlayed || 0,
        ref: { game },
      })
    })

    allRoms.forEach(rom => {
      const id = rom.name
      if (!favIds.has(id)) return
      items.push({
        id,
        name: rom.name,
        icon: rom.banner || rom.icon || PLACEHOLDER_ART,
        kind: 'rom',
        kindLabel: rom.systemName || 'ROM',
        mtime: favAt.get(id) || 0,
        ref: { rom },
      })
    })

    ;(library.media || []).forEach(media => {
      if (!favIds.has(media.path)) return
      items.push({
        id: media.path,
        name: media.name,
        icon: media.path,
        kind: media.isVideo ? 'video' : 'photo',
        kindLabel: media.isVideo ? 'Video' : 'Photo',
        size: media.size,
        mtime: favAt.get(media.path) || media.mtime || 0,
        ref: { media },
      })
    })

    const musicTracks = library.music || []
    const seenTracks = new Set()
    ;[...musicFavorites, ...favorites.map(entry => entry.id)].forEach(path => {
      if (seenTracks.has(path)) return
      seenTracks.add(path)
      const track = musicTracks.find(t => t.path === path || t.id === path)
      if (!track) return
      items.push({
        id: track.path,
        name: track.name || track.path,
        icon: customMusicCovers[track.path] || track.cover || './assets/icons/Music.png',
        kind: 'music',
        kindLabel: 'Music',
        artist: track.artist || '',
        album: track.album || '',
        duration: track.duration || 0,
        mtime: favAt.get(track.path) || 0,
        isFavoriteRef: true,
        ref: { track },
      })
    })

    ;(library.apps || []).forEach(app => {
      if (!favIds.has(app.name)) return
      items.push({
        id: app.name,
        name: app.name,
        icon: app.img,
        kind: 'app',
        kindLabel: 'App',
        mtime: favAt.get(app.name) || 0,
        ref: { app },
      })
    })

    return items
  }, [allGames, allRoms, favorites, library, config.musicFavorites, config.customMusicCovers])

  const pinsFilters = useMemo(() => {
    const favIds = new Set(favorites.map(entry => entry.id))
    const isFavoriteRef = (item) => (item.isFavoriteRef !== undefined ? !!item.isFavoriteRef : favIds.has(item.id))
    return [
      { id: 'all', label: 'All', always: true, test: () => true },
      { id: 'photo', label: 'Photos', test: i => i.kind === 'photo' },
      { id: 'video', label: 'Videos', test: i => i.kind === 'video' },
      { id: 'game', label: 'Games', test: i => i.kind === 'game' },
      { id: 'rom', label: 'ROMs', test: i => i.kind === 'rom' },
      { id: 'music', label: 'Music', test: i => i.kind === 'music' },
      { id: 'app', label: 'Apps', test: i => i.kind === 'app' },
      { id: 'favorites', label: 'Favorites', test: isFavoriteRef },
    ]
  }, [favorites])

  const openPinnedItem = (item) => {
    setShowListModal(false)
    const ref = item.ref || {}
    if (item.kind === 'game' && ref.game) {
      launchGameFromHome(ref.game)
      return
    }
    if (item.kind === 'rom' && ref.rom) {
      launchRomFromHome(ref.rom)
      return
    }
    if (item.kind === 'app' && ref.app) {
      openExternal(ref.app.url, ref.app.name)
      return
    }
    if (ref.media) {
      window.dispatchEvent(new CustomEvent('winx360:open-category', { detail: 'media' }))
      window.dispatchEvent(new CustomEvent('winx360:open-media', { detail: { path: ref.media.path } }))
      return
    }
    if (ref.track) {
      window.dispatchEvent(new CustomEvent('winx360:open-category', { detail: 'music' }))
      window.dispatchEvent(new CustomEvent('winx360:open-track', { detail: { path: ref.track.path } }))
    }
  }

  const togglePinFavorite = (item, next) => {
    if (item.kind === 'music') {
      const path = item.ref?.track?.path
      if (!path) return
      const current = config.musicFavorites || []
      updateConfig('musicFavorites', next ? [...new Set([...current, path])] : current.filter(p => p !== path))
      return
    }
    setFavorite(item.id, next)
  }

  const renderPinArtwork = (item) => {
    if (item.kind === 'video' && item.ref?.media) {
      return <video src={item.ref.media.path} muted preload="metadata" className="app-cover-img" />
    }
    if (!item.icon) return <div className="collection-card-placeholder" />
    return (
      <img
        src={item.icon}
        alt={item.name}
        className="app-cover-img"
        decoding="async"
        loading="lazy"
        onError={handleArtworkError}
      />
    )
  }

  const slideshowGames = useMemo(() => {
    const combined = [
      ...allGames.map(g => ({ ...g, isRom: false })),
      ...allRoms.map(r => ({ ...r, isRom: true, romData: r }))
    ]
    return combined.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
  }, [allGames, allRoms])

  const slideshowPins = useMemo(
    () => [...pinsItems].sort((a, b) => (b.mtime || 0) - (a.mtime || 0)),
    [pinsItems]
  )

  const openPinsList = (e) => {
    e.preventDefault()
    setListModalType('pins')
    setShowListModal(true)
  }

  const handleRomFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    const { ext, systemName } = detectSystem(file.name)
    const name = file.name.replace(/\.[^.]+$/, '')

    if (onOpenApp) {
      onOpenApp({
        type: 'emulator',
        rom: file,
        fileName: file.name,
        core: SYSTEM_CORE_MAP[ext] || 'fceumm',
        label: name,
        systemName
      })
    }
  }

  const handleOpenSubdomain = (url, label) => {
    if (onOpenApp) {
      onOpenApp({ type: 'external', url, label })
    } else {
      window.open(url, '_blank')
    }
  }

  const renderTile = (id, defaultLabel, defaultIcon) => {
    const config = tilesConfig[id] || {}
    let bgUrl = config.bg || ''
    if (bgUrl) {
      bgUrl = bgUrl.replace(/\\/g, '/')
      if (bgUrl.match(/^[a-zA-Z]:/)) {
        bgUrl = `file:///${bgUrl}`
      }
    }
    const style = config.bg ? { backgroundImage: `url("${bgUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}
    return (
      <Tile 
        label={!config.bg && defaultLabel ? defaultLabel : ''} 
        icon={!config.bg && defaultIcon ? defaultIcon : null}
        style={style}
        onClick={() => handleOpenApp(id)}
        onContextMenu={(e) => handleContextMenu(e, id)}
      />
    )
  }

  const handleFileChange = (e, setter) => {
    const file = e.target.files[0]
    if (file) {
      if (isElectron()) {
        setter(file.path)
      } else {
        setter(URL.createObjectURL(file))
      }
    }
  }

  const randomGames = useMemo(() => {
    const shuffled = [...(allGames || [])].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 5)
  }, [allGames])

  const renderRandomGameTile = (id, index) => {
    const config = tilesConfig[id] || {}
    if (config.bg || config.app) {
      return renderTile(id)
    }
    const game = randomGames[index]
    if (game) {
      return (
        <Tile 
          className="game-tile-banner"
          onClick={() => launchGameFromHome(game)}
          onContextMenu={(e) => handleContextMenu(e, id)}
        >
          <img src={game.banner} alt={game.name} className="game-tile-img" />
          <div className="game-tile-name">{game.name}</div>
        </Tile>
      )
    }
    return renderTile(id)
  }

  const renderSubdomainTile = (subdomain) => {
    return (
      <Tile
        label={subdomain.label}
        icon={<img src={subdomain.icon} alt={subdomain.label} />}
        onClick={() => handleOpenSubdomain(subdomain.url, subdomain.label)}
      />
    )
  }

  return (
    <>
      <div className="home-grid">
        {/* Column 1 - Left */}
        <div className="home-c1-r1">
          {slideshowGames.length > 0 ? (
            <SlideshowTile
              items={slideshowGames}
              isActive={isActive}
              onSelect={playSlideGame}
            />
          ) : (
            renderTile('c1-r1', 'Play Game', <img src="./assets/icons/controller.png" alt="Play Game" />)
          )}
        </div>
        <div className="home-c1-r2">
          {slideshowPins.length > 0 ? (
            <SlideshowTile
              items={slideshowPins}
              isActive={isActive}
              onSelect={openPinnedItem}
              keyOf={(pin) => pin.id}
              showName={false}
              onContextMenu={openPinsList}
            />
          ) : (
            renderTile('c1-r2', 'My Pins', <img src="./assets/icons/pin.png" alt="My Pins" />)
          )}
        </div>
        <div className="home-c1-r3">
          {renderTile('c1-r3', 'Recente', <img src="./assets/icons/clock.png" alt="Recente" />)}
        </div>

        {/* Center - ONE big tile 690x393 */}
        <div className="home-center">
          {renderTile('center')}
        </div>

        {/* Bottom middle tiles */}
        <div className="home-c2-r3">
          {renderSubdomainTile(subdomains[0])}
        </div>
        <div className="home-c3-r3">
          {renderSubdomainTile(subdomains[1])}
        </div>

        {/* Column 4 - Right */}
        <div className="home-c4-r1">
          {renderSubdomainTile(subdomains[2])}
        </div>
        <div className="home-c4-r2">
          {renderSubdomainTile(subdomains[3])}
        </div>
        <div className="home-c4-r3">
          {renderSubdomainTile(subdomains[4])}
        </div>
      </div>

      {editingTileId && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Customize Tile</h2>

            <label>Background Image Path</label>
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              <input 
                type="text" 
                placeholder="C:\Images\background.jpg" 
                value={editImgPath} 
                onChange={(e) => setEditImgPath(e.target.value)} 
                style={{ flex: 1 }}
              />
              {isElectron() ? (
                <button className="modal-btn" onClick={async () => {
                  const { ipcRenderer } = window.require('electron')
                  const res = await ipcRenderer.invoke('dialog:openFile', { filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'webp'] }] })
                  if (res && !res.canceled && res.filePaths.length > 0) setEditImgPath(res.filePaths[0])
                }} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              ) : (
                <button className="modal-btn" onClick={() => document.getElementById('tile-bg-input')?.click()} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              )}
              <input id="tile-bg-input" type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileChange(e, setEditImgPath)} />
            </div>

            <label>Executable Path or URL</label>
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              <input 
                type="text" 
                placeholder="C:\Games\game.exe" 
                value={editAppPath} 
                onChange={(e) => setEditAppPath(e.target.value)} 
                style={{ flex: 1 }}
              />
              {isElectron() ? (
                <button className="modal-btn" onClick={async () => {
                  const { ipcRenderer } = window.require('electron')
                  const res = await ipcRenderer.invoke('dialog:openFile', { filters: [{ name: 'Executables', extensions: ['exe', 'bat', 'lnk'] }] })
                  if (res && !res.canceled && res.filePaths.length > 0) setEditAppPath(res.filePaths[0])
                }} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              ) : (
                <button className="modal-btn" onClick={() => document.getElementById('tile-app-input')?.click()} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              )}
              <input id="tile-app-input" type="file" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, setEditAppPath)} />
            </div>

            <div className="modal-actions" style={{marginTop: 20}}>
              <button className="modal-btn cancel" onClick={() => setEditingTileId(null)}>Cancel</button>
              <button className="modal-btn confirm" onClick={handleSaveTile}>Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}

{/* Collection Page for Pins and Recents */}
      {showListModal && (listModalType === 'pins' ? (
        <CollectionPage
          title="My Pins"
          mode="pins"
          variant="apps"
          items={pinsItems}
          filterGroups={pinsFilters}
          sortOptions={PINS_SORT_OPTIONS}
          showSearch
          searchPlaceholder="Search your pins..."
          onToggleFavorite={togglePinFavorite}
          renderItem={renderPinArtwork}
          onClose={() => setShowListModal(false)}
          onItemAction={openPinnedItem}
          emptyMessage="No favorites yet. Tap the ♥ on a game, photo, video, song or app and it will show up here."
          isActive={isActive}
        />
      ) : (
        <CollectionPage
          title="Recent"
          items={[...allGames]
            .filter(g => g.lastPlayed)
            .sort((a, b) => b.lastPlayed - a.lastPlayed)
            .slice(0, 5)
            .map(g => ({ ...g, id: g.name }))}
          onClose={() => setShowListModal(false)}
          onItemAction={(game) => { launchGameFromHome(game); setShowListModal(false) }}
          showPinButton
          filters={[{ label: 'pinned games' }]}
          emptyMessage="No games to show here."
          isActive={isActive}
        />
      ))}
      <input
        ref={romInputRef}
        type="file"
        accept=".nes,.sfc,.smc,.gba,.gb,.gbc,.gen,.md,.sms,.gg,.pce,.ngp,.ngpc,.ws,.wsc,.lnx,.jag,.vb,.col,.sg"
        style={{ display: 'none' }}
        onChange={handleRomFileSelect}
      />
    </>
  )
}


