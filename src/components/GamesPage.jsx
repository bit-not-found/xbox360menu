import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath, getNodeChildProcess } from '../utils/electron'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')

const ROM_EXTENSIONS = /\.(nes|sfc|smc|gba|gb|gbc|gen|md|sms|gg|pce|ngp|ngpc|ws|wsc|lnx|jag|vb|col|sg)$/i

const SYSTEM_CORE_MAP = {
  nes: 'fceumm',
  sfc: 'snes9x',
  smc: 'snes9x',
  gba: 'mgba',
  gb: 'mgba',
  gbc: 'mgba',
  gen: 'genesis_plus_gx',
  md: 'genesis_plus_gx',
  sms: 'genesis_plus_gx',
  gg: 'genesis_plus_gx',
  pce: 'mednafen_pce',
  ngp: 'meowatch',
  ngpc: 'meowatch',
  ws: 'mednafen_wswan',
  wsc: 'mednafen_wswan',
  lnx: 'handy',
  jag: 'virtualjaguar',
  vb: 'mednafen_vb',
  col: 'col'
}

const CORE_LABELS = {
  fceumm: 'NES (FCEUmm)',
  snes9x: 'SNES (Snes9x)',
  mgba: 'GBA/GB/GBC (mGBA)',
  genesis_plus_gx: 'Genesis/MD/SMS/GG (Genesis Plus GX)',
  mednafen_pce: 'PC Engine (Mednafen)',
  meowatch: 'Neo Geo Pocket (Meowatch)',
  mednafen_wswan: 'WonderSwan (Mednafen)',
  handy: 'Lynx (Handy)',
  virtualjaguar: 'Jaguar (VirtualJag)',
  mednafen_vb: 'Virtual Boy (Mednafen)',
  col: 'ColecoVision (Col)'
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

export default function GamesPage({ onOpenApp }) {
  const { config, updateConfig } = useConfig()
  const games = config.myGames
  const romFolder = config.romFolder || ''
  const myRoms = config.myRoms || []

  const [showAddModal, setShowAddModal] = useState(false)
  const [showMyGames, setShowMyGames] = useState(false)
  const [isClosingMyGames, setIsClosingMyGames] = useState(false)
  const [showMyRoms, setShowMyRoms] = useState(false)
  const [isClosingMyRoms, setIsClosingMyRoms] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [newGameExe, setNewGameExe] = useState('')
  const [previewIcon, setPreviewIcon] = useState(null)
  const [previewBanner, setPreviewBanner] = useState(null)
  const [editingGameName, setEditingGameName] = useState(null)
  const [igdbClientId, setIgdbClientId] = useState(() => localStorage.getItem('igdbClientId') || '')
  const [igdbToken, setIgdbToken] = useState(() => localStorage.getItem('igdbToken') || '')
  const [showIgdbSetup, setShowIgdbSetup] = useState(false)
  const [isSearchingOnline, setIsSearchingOnline] = useState(false)
  const [onlineSearchResults, setOnlineSearchResults] = useState([])

  const iconInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const exeInputRef = useRef(null)
  const romFolderInputRef = useRef(null)
  const romFileCache = useRef(new Map())

  const setGames = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('myGames', newVal(games))
    } else {
      updateConfig('myGames', newVal)
    }
  }

  const setRoms = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('myRoms', newVal(myRoms))
    } else {
      updateConfig('myRoms', newVal)
    }
  }

  useEffect(() => {
    window.dispatchEvent(new Event('games-updated'))
  }, [games])

  // Scan ROM folder on mount (Electron only, browser requires re-selection)
  useEffect(() => {
    if (romFolder && isElectron()) {
      try {
        const fs = getNodeFs()
        const path = getNodePath()
        if (!fs || !path) return

        const getFilesRecursively = (dir, fileList = []) => {
          if (!fs.existsSync(dir)) return fileList
          const files = fs.readdirSync(dir)
          for (const file of files) {
            const filePath = path.join(dir, file)
            if (fs.statSync(filePath).isDirectory()) {
              getFilesRecursively(filePath, fileList)
            } else if (ROM_EXTENSIONS.test(file)) {
              const { ext, system, systemName } = detectSystem(file)
              fileList.push({
                name: file.replace(/\.[^.]+$/, ''),
                path: filePath,
                ext,
                system,
                systemName,
                core: SYSTEM_CORE_MAP[ext] || 'fceumm'
              })
            }
          }
          return fileList
        }

        const roms = getFilesRecursively(romFolder)
        setRoms(roms)
      } catch (e) {
        console.log('ROM scan failed:', e.message)
      }
    }
  }, [romFolder, setRoms])

  const openRomFolder = async () => {
    if (isElectron()) {
      try {
        const ipcRenderer = getIpcRenderer()
        const result = await ipcRenderer.invoke('dialog:openDirectory')
        if (result && !result.canceled && result.filePaths.length > 0) {
          updateConfig('romFolder', result.filePaths[0])
        }
      } catch (e) {
        console.log('Cannot open folder dialog', e)
      }
    } else {
      romFolderInputRef.current?.click()
    }
  }

  const handleRomFolderInput = (e) => {
    const files = Array.from(e.target.files)
    const romEntries = files
      .filter(f => ROM_EXTENSIONS.test(f.name))
      .map(f => {
        const { ext, system, systemName } = detectSystem(f.name)
        const name = f.name.replace(/\.[^.]+$/, '')
        romFileCache.current.set(name, f)
        return {
          name,
          ext,
          system,
          systemName,
          core: SYSTEM_CORE_MAP[ext] || 'fceumm'
        }
      })
    setRoms(romEntries)
    updateConfig('romFolder', e.target.files[0]?.webkitRelativePath?.split('/')[0] || 'ROMs')
  }

  const launchRom = async (rom) => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})

    let romData = null

    if (isElectron() && rom.path) {
      try {
        const fs = getNodeFs()
        if (fs && fs.promises && fs.promises.readFile) {
          const data = await fs.promises.readFile(rom.path)
          romData = new Blob([data])
        } else if (fs && fs.readFileSync) {
          const data = fs.readFileSync(rom.path)
          romData = new Blob([data])
        }
      } catch (e) {
        console.error('Failed to read ROM file:', e)
      }
    } else {
      romData = romFileCache.current.get(rom.name) || null
    }

    if (!romData) {
      alert('ROM file not available. Please re-select your ROM folder.')
      return
    }

    if (onOpenApp) {
      onOpenApp({
        type: 'emulator',
        rom: romData,
        core: rom.core || 'fceumm',
        label: rom.name,
        systemName: rom.systemName
      })
    }
  }

  const updateRomCore = (romName, newCore, e) => {
    e.stopPropagation()
    setRoms(prev => prev.map(r => r.name === romName ? { ...r, core: newCore } : r))
  }

  // Existing game functions
  const searchOnlineDatabase = async () => {
    if (!igdbClientId || !igdbToken) {
      setShowIgdbSetup(true)
      return
    }
    if (!newGameName) {
      alert("Please type a game name first!")
      return
    }
    setIsSearchingOnline(true)
    setOnlineSearchResults([])
    try {
      const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': igdbClientId,
          'Authorization': `Bearer ${igdbToken}`,
          'Accept': 'application/json',
          'Content-Type': 'text/plain'
        },
        body: `search "${newGameName}"; fields name, cover.image_id, screenshots.image_id; limit 15;`
      })
      const parsed = await response.json()
      setOnlineSearchResults(Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : [{ id: 'none', name: 'No games found' }])
    } catch {
      setOnlineSearchResults([{ id: 'none', name: 'Search Failed' }])
    }
  }

  const applyOnlineGame = (gameItem) => {
    setNewGameName(gameItem.name)
    setOnlineSearchResults([])
    setIsSearchingOnline(false)
    let coverUrl = ''
    if (gameItem.cover && gameItem.cover.image_id) {
      coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${gameItem.cover.image_id}.jpg`
    }
    let bannerUrl = coverUrl
    if (gameItem.screenshots && gameItem.screenshots.length > 0) {
      bannerUrl = `https://images.igdb.com/igdb/image/upload/t_1080p/${gameItem.screenshots[0].image_id}.jpg`
    }
    if (coverUrl) setPreviewIcon(coverUrl)
    if (bannerUrl) setPreviewBanner(bannerUrl)
  }

  const handleDeleteGame = () => {
    if (editingGameName) {
      setGames(prev => prev.filter(g => g.name !== editingGameName))
      setShowAddModal(false)
      setEditingGameName(null)
    }
  }

  const openEditModal = (game, e) => {
    e.stopPropagation()
    setEditingGameName(game.name)
    setNewGameName(game.name)
    setNewGameExe(game.exe || '')
    setPreviewIcon(null)
    setPreviewBanner(null)
    setShowAddModal(true)
  }

  const handleAddGame = () => {
    if (!newGameName) return
    const iconUrl = previewIcon || './assets/imgs/260x195-PLACEHOLDER.png'
    const bannerUrl = previewBanner || previewIcon || './assets/imgs/260x195-PLACEHOLDER.png'
    if (editingGameName) {
      setGames(prev => prev.map(g => g.name === editingGameName ? {
        ...g, name: newGameName, exe: newGameExe,
        icon: previewIcon ? iconUrl : g.icon,
        banner: previewBanner ? bannerUrl : (previewIcon ? iconUrl : g.banner)
      } : g))
    } else {
      setGames([...games, {
        name: newGameName, exe: newGameExe, icon: iconUrl, banner: bannerUrl,
        stars: 5, isPinned: false, lastPlayed: 0
      }])
    }
    setNewGameName('')
    setNewGameExe('')
    setPreviewIcon(null)
    setPreviewBanner(null)
    setEditingGameName(null)
    setShowAddModal(false)
  }

  const launchGame = (game) => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
    setGames(prev => prev.map(g => g.name === game.name ? { ...g, lastPlayed: Date.now() } : g))
    if (game.exe && isElectron()) {
      try {
        const exec = getNodeChildProcess()
        const path = getNodePath()
        if (exec && path) {
          exec(`start "" "${game.exe}"`, { cwd: path.dirname(game.exe) }, (err) => {
            if (err) console.error('Failed to launch:', err)
          })
        }
      } catch (e) {
        console.log('Cannot launch:', game.exe, e)
      }
    } else if (game.exe) {
      alert('Game launching is only available in the desktop app.')
    }
  }

  const togglePin = (gameToToggle, e) => {
    e.stopPropagation()
    setGames(prev => prev.map(g => g.name === gameToToggle.name ? { ...g, isPinned: !g.isPinned } : g))
  }

  const handleCardHover = () => {
    hoverAudio.currentTime = 0
    hoverAudio.play().catch(() => {})
  }

  const closeMyGames = () => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosingMyGames(true)
    setTimeout(() => { setShowMyGames(false); setIsClosingMyGames(false) }, 300)
  }

  const openMyGames = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
    setShowMyGames(true)
  }

  const closeMyRoms = () => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => {})
    setIsClosingMyRoms(true)
    setTimeout(() => { setShowMyRoms(false); setIsClosingMyRoms(false) }, 300)
  }

  const renderStars = (count) => {
    const c = count || 0
    return '★'.repeat(c) + '☆'.repeat(5 - c)
  }

  const handleIconFile = (e) => {
    const file = e.target.files[0]
    if (file) setPreviewIcon(URL.createObjectURL(file))
  }

  const handleBannerFile = (e) => {
    const file = e.target.files[0]
    if (file) setPreviewBanner(URL.createObjectURL(file))
  }

  const handleExeFile = (e) => {
    const file = e.target.files[0]
    if (file) setNewGameExe(isElectron() ? file.path : file.name)
  }

  const openFileElectron = async (setter, filters) => {
    if (!isElectron()) return
    try {
      const ipcRenderer = getIpcRenderer()
      const result = await ipcRenderer.invoke('dialog:openFile', { filters })
      if (result && !result.canceled && result.filePaths.length > 0) {
        let fp = result.filePaths[0].replace(/\\/g, '/')
        if (fp.match(/^[a-zA-Z]:/)) fp = `file:///${fp}`
        setter(fp)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const allRoms = myRoms

  const renderRomTile = (rom) => {
    if (!rom) return <Tile />
    return (
      <Tile
        key={rom.name}
        className="game-tile-banner rom-tile"
        onClick={() => launchRom(rom)}
      >
        <div className="rom-tile-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="8" cy="12" r="2" />
            <rect x="13" y="10" width="5" height="4" rx="1" />
          </svg>
        </div>
        <div className="rom-tile-system">{rom.systemName}</div>
        <div className="game-tile-name">{rom.name}</div>
      </Tile>
    )
  }

  return (
    <>
      <div className="games-grid">
        <div className="games-c1-r1">
          <Tile
            label="My Games"
            icon={<img src="./assets/icons/controller.png" alt="My Games" />}
            onClick={openMyGames}
          />
        </div>
        <div className="games-c1-r2">
          <Tile
            label="ROM Folder"
            icon={<img src="./assets/icons/Folder.png" alt="ROM Folder" />}
            onClick={openRomFolder}
          />
        </div>

        <div className="games-center">
          {allRoms.length > 0 ? (
            renderRomTile(allRoms[0])
          ) : games.length > 0 ? (
            <Tile
              className="game-tile-banner"
              onClick={() => launchGame(games[0])}
              onContextMenu={(e) => openEditModal(games[0], e)}
            >
              <img src={games[0].banner} alt={games[0].name} className="game-tile-img" />
              <div className="game-tile-name">{games[0].name}</div>
            </Tile>
          ) : (
            <Tile label="No Games" />
          )}
        </div>

        <div className="games-c3-r1">
          {allRoms.length > 1 ? (
            renderRomTile(allRoms[1])
          ) : games.length > 1 ? (
            <Tile
              className="game-tile-banner"
              onClick={() => launchGame(games[1])}
              onContextMenu={(e) => openEditModal(games[1], e)}
            >
              <img src={games[1].banner} alt={games[1].name} className="game-tile-img" />
              <div className="game-tile-name">{games[1].name}</div>
            </Tile>
          ) : <Tile />}
        </div>
        <div className="games-c3-r2">
          {allRoms.length > 2 ? (
            renderRomTile(allRoms[2])
          ) : games.length > 2 ? (
            <Tile
              className="game-tile-banner"
              onClick={() => launchGame(games[2])}
              onContextMenu={(e) => openEditModal(games[2], e)}
            >
              <img src={games[2].banner} alt={games[2].name} className="game-tile-img" />
              <div className="game-tile-name">{games[2].name}</div>
            </Tile>
          ) : <Tile />}
        </div>

        <div className="games-c4-r1">
          {allRoms.length > 3 ? (
            renderRomTile(allRoms[3])
          ) : games.length > 3 ? (
            <Tile
              className="game-tile-banner"
              onClick={() => launchGame(games[3])}
              onContextMenu={(e) => openEditModal(games[3], e)}
            >
              <img src={games[3].banner} alt={games[3].name} className="game-tile-img" />
              <div className="game-tile-name">{games[3].name}</div>
            </Tile>
          ) : <Tile />}
        </div>
        <div className="games-c4-r2">
          {allRoms.length > 4 ? (
            renderRomTile(allRoms[4])
          ) : games.length > 4 ? (
            <Tile
              className="game-tile-banner"
              onClick={() => launchGame(games[4])}
              onContextMenu={(e) => openEditModal(games[4], e)}
            >
              <img src={games[4].banner} alt={games[4].name} className="game-tile-img" />
              <div className="game-tile-name">{games[4].name}</div>
            </Tile>
          ) : <Tile />}
        </div>
      </div>

      <input ref={romFolderInputRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={handleRomFolderInput} />

      {/* MY GAMES FULL SCREEN */}
      {showMyGames && createPortal(
        <div className={`mygames-overlay ${isClosingMyGames ? 'closing' : ''}`}>
          <div className="mygames-header">
            <h2>My Games</h2>
            <span className="mygames-count">{games.length} games</span>
            <button className="video-player-close" onClick={closeMyGames}>✕</button>
          </div>
          <div className="mygames-cards-scroll">
            {games.map((game) => (
              <div
                key={game.name}
                className="game-card"
                onMouseEnter={handleCardHover}
                onClick={() => { launchGame(game); closeMyGames() }}
              >
                <div className="game-card-img">
                  <img src={game.icon} alt={game.name} />
                </div>
                <div className="game-card-info">
                  <div className="game-card-title">{game.name}</div>
                  <div className="game-card-stars" style={{ fontSize: '24px', letterSpacing: '2px', color: '#ffb400', marginTop: '5px', marginBottom: '5px' }}>{renderStars(game.stars)}</div>
                  <div className="game-card-platform" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><span className="game-card-platform-icon">🎮</span> PC</span>
                    <div>
                      <button className="modal-btn" style={{ padding: '2px 10px', fontSize: '14px', height: 'auto', backgroundColor: '#333', marginRight: '5px' }} onClick={(e) => openEditModal(game, e)}>
                        Edit
                      </button>
                      <button className="modal-btn" style={{ padding: '2px 10px', fontSize: '14px', height: 'auto', backgroundColor: game.isPinned ? '#ff4444' : '#107c10' }} onClick={(e) => togglePin(game, e)}>
                        {game.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* MY ROMS FULL SCREEN */}
      {showMyRoms && createPortal(
        <div className={`mygames-overlay ${isClosingMyRoms ? 'closing' : ''}`}>
          <div className="mygames-header">
            <h2>My ROMs</h2>
            <span className="mygames-count">{allRoms.length} ROMs</span>
            <button className="video-player-close" onClick={closeMyRoms}>✕</button>
          </div>
          <div className="mygames-cards-scroll">
            {allRoms.length === 0 ? (
              <div style={{ color: '#aaa', padding: 40, textAlign: 'center', fontSize: 16 }}>
                No ROMs found. Select a ROM folder to scan for games.
              </div>
            ) : (
              allRoms.map((rom) => (
                <div
                  key={rom.name}
                  className="game-card rom-card"
                  onMouseEnter={handleCardHover}
                  onClick={() => { launchRom(rom); closeMyRoms() }}
                >
                  <div className="game-card-img rom-card-img">
                    <div className="rom-card-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="1.5">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <circle cx="8" cy="12" r="2" />
                        <rect x="13" y="10" width="5" height="4" rx="1" />
                      </svg>
                    </div>
                  </div>
                  <div className="game-card-info">
                    <div className="game-card-title">{rom.name}</div>
                    <div style={{ fontSize: '13px', color: '#107c10', marginTop: 4 }}>{rom.systemName}</div>
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: 3 }}>Core</label>
                      <select
                        className="rom-core-select"
                        value={rom.core}
                        onChange={(e) => updateRomCore(rom.name, e.target.value, e)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(CORE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ADD GAME MODAL */}
      {showAddModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingGameName ? 'Edit Game' : 'Add Game'}</h2>

            <label>Game Name</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type="text"
                placeholder="Ex: Halo Infinite"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="modal-btn"
                onClick={searchOnlineDatabase}
                style={{ padding: '0 15px', fontSize: 14, backgroundColor: '#107c10' }}
              >
                IGDB Search
              </button>
            </div>

            <label>Executable Path</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type="text"
                placeholder="C:\Games\game.exe"
                value={newGameExe}
                onChange={(e) => setNewGameExe(e.target.value)}
                style={{ flex: 1 }}
              />
              {isElectron() ? (
                <button
                  className="modal-btn"
                  onClick={() => openFileElectron(setNewGameExe, [{ name: 'Executables', extensions: ['exe', 'bat', 'lnk'] }])}
                  style={{ padding: '0 15px', fontSize: 20 }}
                >
                  +
                </button>
              ) : (
                <>
                  <input ref={exeInputRef} type="file" style={{ display: 'none' }} onChange={handleExeFile} accept=".exe,.bat,.lnk" />
                  <button
                    className="modal-btn"
                    onClick={() => exeInputRef.current?.click()}
                    style={{ padding: '0 15px', fontSize: 20 }}
                  >
                    +
                  </button>
                </>
              )}
            </div>

            <label>Cover Art</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input type="text" placeholder="Path to Cover Art" value={previewIcon || ''} readOnly style={{ flex: 1 }} />
              {isElectron() ? (
                <button className="modal-btn" onClick={() => openFileElectron(setPreviewIcon, [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'webp'] }])} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              ) : (
                <>
                  <input ref={iconInputRef} type="file" style={{ display: 'none' }} onChange={handleIconFile} accept="image/*" />
                  <button className="modal-btn" onClick={() => iconInputRef.current?.click()} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
                </>
              )}
            </div>
            {previewIcon && (
              <div className="modal-icon-preview">
                <img src={previewIcon} alt="Icon Preview" />
              </div>
            )}

            <label>Banner Image (for tile)</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input type="text" placeholder="Path to Banner" value={previewBanner || ''} readOnly style={{ flex: 1 }} />
              {isElectron() ? (
                <button className="modal-btn" onClick={() => openFileElectron(setPreviewBanner, [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'webp'] }])} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              ) : (
                <>
                  <input ref={bannerInputRef} type="file" style={{ display: 'none' }} onChange={handleBannerFile} accept="image/*" />
                  <button className="modal-btn" onClick={() => bannerInputRef.current?.click()} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
                </>
              )}
            </div>
            {previewBanner && (
              <div className="modal-icon-preview" style={{ width: 170, height: 200 }}>
                <img src={previewBanner} alt="Banner Preview" />
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              {editingGameName && (
                <button className="modal-btn" style={{ backgroundColor: '#ff4444' }} onClick={handleDeleteGame}>Delete</button>
              )}
              <button className="modal-btn confirm" onClick={handleAddGame}>{editingGameName ? 'Save Changes' : 'Add Game'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* IGDB SETUP MODAL */}
      {showIgdbSetup && createPortal(
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>IGDB API Setup</h2>
            <p style={{ fontSize: 14, color: '#aaa', marginBottom: 15 }}>Enter your Twitch Developer Client ID and App Access Token to enable official IGDB Search.</p>

            <label>Client ID</label>
            <input type="text" value={igdbClientId} onChange={(e) => setIgdbClientId(e.target.value)} placeholder="Client ID" />

            <label>App Access Token</label>
            <input type="text" value={igdbToken} onChange={(e) => setIgdbToken(e.target.value)} placeholder="Bearer Token" />

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="modal-btn cancel" onClick={() => setShowIgdbSetup(false)}>Cancel</button>
              <button className="modal-btn confirm" onClick={() => {
                localStorage.setItem('igdbClientId', igdbClientId)
                localStorage.setItem('igdbToken', igdbToken)
                setShowIgdbSetup(false)
              }}>Save Keys</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ONLINE SEARCH RESULTS MODAL */}
      {isSearchingOnline && createPortal(
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>IGDB Search Results</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {onlineSearchResults.map(game => (
                <div
                  key={game.id}
                  style={{ background: '#333', padding: 5, borderRadius: 5, cursor: game.id === 'none' ? 'default' : 'pointer', textAlign: 'center' }}
                  onClick={() => game.id !== 'none' && applyOnlineGame(game)}
                >
                  {game.cover && game.cover.image_id && (
                    <img src={`https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`} alt={game.name} style={{ width: '100%', borderRadius: 3 }} />
                  )}
                  <div style={{ fontSize: '12px', marginTop: 5 }}>{game.name}</div>
                </div>
              ))}
              {onlineSearchResults.length === 0 && <div style={{ color: '#aaa' }}>Searching IGDB...</div>}
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="modal-btn cancel" onClick={() => { setIsSearchingOnline(false); setOnlineSearchResults([]); }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
