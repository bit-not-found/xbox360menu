import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import CollectionPage from './CollectionPage'
import { useConfig } from '../context/ConfigContext'
import { isElectron } from '../utils/electron'

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
  const allGames = config.myGames || []
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
      const recent = [...allGames].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
      if (recent.length > 0 && recent[0].lastPlayed && recent[0].exe && isElectron()) {
        launchGameFromHome(recent[0])
      } else {
        romInputRef.current?.click()
      }
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
      } catch(e) {}
    }
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
          {(() => {
            const recent = [...(allGames || [])].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
            const lastGame = recent.length > 0 && recent[0].lastPlayed ? recent[0] : null
            if (lastGame) {
              return (
                <Tile 
                  label={lastGame.name}
                  icon={<img src="./assets/icons/controller.png" alt="Play Game" />}
                  style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("${lastGame.banner}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  onClick={() => handleOpenApp('c1-r1')}
                  onContextMenu={(e) => handleContextMenu(e, 'c1-r1')}
                />
              )
            }
            return renderTile('c1-r1', 'Play Game', <img src="./assets/icons/controller.png" alt="Play Game" />)
          })()}
        </div>
        <div className="home-c1-r2">
          {renderTile('c1-r2', 'My Pins', <img src="./assets/icons/pin.png" alt="My Pins" />)}
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
      {showListModal && (
        <CollectionPage
          title={listModalType === 'pins' ? 'My Pins' : 'Recent'}
          items={(listModalType === 'pins'
            ? (allGames || []).filter(g => g.isPinned)
            : [...(allGames || [])].filter(g => g.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 5)
          ).map(g => ({ ...g, id: g.name }))}
          onClose={() => setShowListModal(false)}
          onItemAction={(game) => { launchGameFromHome(game); setShowListModal(false); }}
          showPinButton={listModalType === 'pins'}
          filters={[{ label: 'pinned games' }]}
          emptyMessage="No games to show here."
          isActive={isActive}
        />
      )}
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


