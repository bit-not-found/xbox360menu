import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import CollectionPage from './CollectionPage'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath, getNodeChildProcess } from '../utils/electron'
import { saveRomFile, loadRomFile } from '../utils/romCache'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

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

export default function GamesPage({ onOpenApp, isActive }) {
  const { config, updateConfig } = useConfig()
  const games = config.myGames
  const romFolder = config.romFolder || ''
  const myRoms = config.myRoms || []

  const [showAddModal, setShowAddModal] = useState(false)
  const [showMyGames, setShowMyGames] = useState(false)
  const [showMyRoms, setShowMyRoms] = useState(false)
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
  const [gameType, setGameType] = useState('executable')
  const [romFile, setRomFile] = useState(null)

  const iconInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const exeInputRef = useRef(null)
  const romFileInputRef = useRef(null)
  const romFolderInputRef = useRef(null)

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

  useEffect(() => {
    if (!isActive) {
      setShowAddModal(false)
      setShowMyGames(false)
      setShowMyRoms(false)
      setShowIgdbSetup(false)
      setIsSearchingOnline(false)
      setOnlineSearchResults([])
      setEditingGameName(null)
    }
  }, [isActive])

  useEffect(() => {
    const closeAll = () => {
      setShowAddModal(false)
      setShowMyGames(false)
      setShowMyRoms(false)
      setShowIgdbSetup(false)
      setIsSearchingOnline(false)
      setOnlineSearchResults([])
      setEditingGameName(null)
    }
    window.addEventListener('guide-opened', closeAll)
    return () => window.removeEventListener('guide-opened', closeAll)
  }, [])

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

        const scannedRoms = getFilesRecursively(romFolder)
        const existing = config.myRoms || []
        const existingPaths = new Set(existing.map(r => r.path))
        const existingNames = new Set(existing.map(r => `${r.name}.${r.ext}`))
        const newRoms = scannedRoms.filter(r => !existingPaths.has(r.path) && !existingNames.has(`${r.name}.${r.ext}`))
        if (newRoms.length > 0) {
          updateConfig('myRoms', [...existing, ...newRoms])
        }
      } catch (e) {
        console.log('ROM scan failed:', e.message)
      }
    }
  }, [romFolder])

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

  const handleRomFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    const { ext, system, systemName } = detectSystem(file.name)
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

  const launchRom = async (rom) => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})

    let romData = null
    const fileName = `${rom.name}.${rom.ext}`
    const cacheKey = fileName

    try {
      const cachedFile = await loadRomFile(cacheKey)
      if (cachedFile) {
        romData = cachedFile instanceof Blob ? cachedFile : new Blob([cachedFile])
      }
    } catch (e) {
      console.warn('Failed to load ROM from cache:', e)
    }

    if (!romData && rom.path) {
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
      if (gameType === 'rom') {
        setRoms(prev => prev.filter(r => r.name !== editingGameName))
      } else {
        setGames(prev => prev.filter(g => g.name !== editingGameName))
      }
      setShowAddModal(false)
      setEditingGameName(null)
    }
  }

  const openEditModal = (game, e) => {
    e.stopPropagation()
    setEditingGameName(game.name)
    setNewGameName(game.name)
    setNewGameExe(game.exe || '')
    setPreviewIcon(game.icon || null)
    setPreviewBanner(game.banner || null)
    if (game.isRom) {
      setGameType('rom')
      setRomFile({ name: game.name, path: game.path, ext: game.ext, system: game.system, systemName: game.systemName, core: game.core })
    } else {
      setGameType('executable')
      setRomFile(null)
    }
    setShowAddModal(true)
  }

  const handleAddGame = () => {
    if (!newGameName) return
    const iconUrl = previewIcon || './assets/imgs/260x195-PLACEHOLDER.png'
    const bannerUrl = previewBanner || previewIcon || './assets/imgs/260x195-PLACEHOLDER.png'

    if (gameType === 'rom' && romFile) {
      const cacheKey = `${newGameName}.${romFile.ext}`
      const romEntry = {
        name: newGameName,
        path: romFile.path,
        ext: romFile.ext,
        system: romFile.system,
        systemName: romFile.systemName,
        core: romFile.core,
        icon: previewIcon || null,
        banner: previewBanner || null,
      }
      if (editingGameName) {
        const oldCacheKey = `${editingGameName}.${romFile.ext}`
        setRoms(prev => prev.map(r => r.name === editingGameName ? { ...r, ...romEntry } : r))
        if (romFile.file) {
          saveRomFile(cacheKey, romFile.file)
          if (oldCacheKey !== cacheKey) saveRomFile(oldCacheKey, romFile.file)
        }
      } else {
        setRoms(prev => [...prev, romEntry])
        if (romFile.file) saveRomFile(cacheKey, romFile.file)
      }
    } else {
      if (editingGameName) {
        setGames(prev => prev.map(g => g.name === editingGameName ? {
          ...g, name: newGameName, exe: newGameExe,
          icon: previewIcon || g.icon,
          banner: previewBanner || g.banner
        } : g))
      } else {
        setGames(prev => [...prev, {
          name: newGameName, exe: newGameExe, icon: iconUrl, banner: bannerUrl,
          stars: 5, isPinned: false, lastPlayed: 0
        }])
      }
    }

    setNewGameName('')
    setNewGameExe('')
    setPreviewIcon(null)
    setPreviewBanner(null)
    setEditingGameName(null)
    setGameType('executable')
    setRomFile(null)
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
          const exeDir = path.dirname(game.exe)
          exec(`start "" "${game.exe}"`, { cwd: exeDir }, (err) => {
            if (err) console.error('Failed to launch:', err)
          })
        } else {
          alert('Could not access system launch tools. Please restart the app.')
        }
      } catch (e) {
        console.log('Cannot launch:', game.exe, e)
        alert('Failed to launch game: ' + e.message)
      }
    } else if (game.exe) {
      alert('Game launching is only available in the desktop app.')
    } else {
      alert('No executable path set for this game. Right-click to edit and set the path.')
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
    setShowMyGames(false)
  }

  const openMyGames = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => {})
    setShowMyGames(true)
  }

  const closeMyRoms = () => {
    setShowMyRoms(false)
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

  const handleRomFileSelectForAdd = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    const { ext, system, systemName } = detectSystem(file.name)
    const name = file.name.replace(/\.[^.]+$/, '')
    const filePath = isElectron() ? file.path : file.name

    setRomFile({ name, path: filePath, file, ext, system, systemName, core: SYSTEM_CORE_MAP[ext] || 'fceumm' })
    if (!newGameName) setNewGameName(name)
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

  // Combined list of all games (myGames + myRoms) for My Games collection
  const allMyGames = [
    ...games.map(g => ({ ...g, id: g.name, isRom: false })),
    ...myRoms.map(r => ({
      id: r.name,
      name: r.name,
      icon: r.icon || null,
      banner: r.banner || null,
      systemName: r.systemName,
      core: r.core,
      exe: null,
      isRom: true,
      stars: 0,
      isPinned: false,
      lastPlayed: 0,
      romData: r,
    }))
  ]

  const myGameSystems = [...new Set(allMyGames.map(g => g.systemName).filter(Boolean))].sort()

  const openAddGameFromMyGames = () => {
    setEditingGameName(null)
    setNewGameName('')
    setNewGameExe('')
    setPreviewIcon(null)
    setPreviewBanner(null)
    setGameType('executable')
    setRomFile(null)
    setShowAddModal(true)
  }

  const allRoms = myRoms

  const allDisplayGames = [
    ...games.map(g => ({ ...g, _type: 'game' })),
    ...myRoms.map(r => ({ ...r, _type: 'rom', romData: r }))
  ]

  const renderRomTile = (rom) => {
    if (!rom) return <Tile />
    const bannerImg = rom.banner || rom.icon
    return (
      <Tile
        key={rom.name}
        className="game-tile-banner rom-tile"
        onClick={() => launchRom(rom)}
      >
        {bannerImg ? (
          <img src={bannerImg} alt={rom.name} className="game-tile-img" />
        ) : (
          <>
            <div className="rom-tile-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="8" cy="12" r="2" />
                <rect x="13" y="10" width="5" height="4" rx="1" />
              </svg>
            </div>
            <div className="rom-tile-system">{rom.systemName}</div>
          </>
        )}
        <div className="game-tile-name">{rom.name}</div>
      </Tile>
    )
  }

  const renderDisplayTile = (item) => {
    if (!item) return <Tile />
    if (item._type === 'rom') {
      return renderRomTile(item)
    }
    return (
      <Tile
        className="game-tile-banner"
        onClick={() => launchGame(item)}
        onContextMenu={(e) => openEditModal(item, e)}
      >
        <img src={item.banner} alt={item.name} className="game-tile-img" />
        <div className="game-tile-name">{item.name}</div>
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
            label="Open Game"
            icon={<img src="./assets/icons/Folder.png" alt="Open Game" />}
            onClick={openRomFolder}
          />
        </div>

        <div className="games-center">
          {allDisplayGames.length > 0 ? renderDisplayTile(allDisplayGames[0]) : <Tile label="No Games" />}
        </div>

        <div className="games-c3-r1">
          {allDisplayGames.length > 1 ? renderDisplayTile(allDisplayGames[1]) : <Tile />}
        </div>
        <div className="games-c3-r2">
          {allDisplayGames.length > 2 ? renderDisplayTile(allDisplayGames[2]) : <Tile />}
        </div>

        <div className="games-c4-r1">
          {allDisplayGames.length > 3 ? renderDisplayTile(allDisplayGames[3]) : <Tile />}
        </div>
        <div className="games-c4-r2">
          {allDisplayGames.length > 4 ? renderDisplayTile(allDisplayGames[4]) : <Tile />}
        </div>
      </div>

      <input ref={romFolderInputRef} type="file" accept=".nes,.sfc,.smc,.gba,.gb,.gbc,.gen,.md,.sms,.gg,.pce,.ngp,.ngpc,.ws,.wsc,.lnx,.jag,.vb,.col,.sg" style={{ display: 'none' }} onChange={handleRomFileSelect} />

      {/* MY GAMES COLLECTION */}
      {showMyGames && (
        <CollectionPage
          title="My Games"
          items={allMyGames}
          onClose={closeMyGames}
          onItemAction={(game) => {
            if (game.isRom) launchRom(game.romData)
            else launchGame(game)
            closeMyGames()
          }}
          onEditItem={(item) => {
            if (item.isRom) {
              openEditModal({ ...item, ...item.romData, isRom: true }, new Event('click'))
            } else {
              openEditModal(item, new Event('click'))
            }
          }}
          emptyMessage="No games added yet. Click + Add Game to get started."
          isActive={isActive}
          mode="games"
          systems={myGameSystems}
          onAddItem={openAddGameFromMyGames}
          onDeleteItem={(item) => {
            if (item.isRom) {
              setRoms(prev => prev.filter(r => r.name !== item.name))
            } else {
              setGames(prev => prev.filter(g => g.name !== item.name))
            }
          }}
          renderItem={(item) => {
            if (item.isRom) {
              const coverImg = item.icon || item.banner
              if (coverImg) {
                return <img src={coverImg} alt={item.name} decoding="async" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="1.5">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <circle cx="8" cy="12" r="2" />
                    <rect x="13" y="10" width="5" height="4" rx="1" />
                  </svg>
                  <span style={{ fontSize: '0.7rem', color: '#107c10' }}>{item.systemName}</span>
                </div>
              )
            }
            return null
          }}
        />
      )}

      {/* MY ROMS COLLECTION */}
      {showMyRoms && (
        <CollectionPage
          title="My ROMs"
          items={allRoms.map(r => ({ ...r, id: r.name }))}
          onClose={closeMyRoms}
          onItemAction={(rom) => { launchRom(rom); closeMyRoms(); }}
          filters={[{ label: 'all roms' }]}
          emptyMessage="No ROMs found. Select a ROM folder to scan for games."
          isActive={isActive}
          renderItem={(rom) => {
            const coverImg = rom.icon || rom.banner
            if (coverImg) {
              return <img src={coverImg} alt={rom.name} decoding="async" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="8" cy="12" r="2" />
                  <rect x="13" y="10" width="5" height="4" rx="1" />
                </svg>
                <span style={{ fontSize: '0.7rem', color: '#107c10' }}>{rom.systemName}</span>
              </div>
            )
          }}
        />
      )}

      {/* ADD GAME MODAL */}
      {showAddModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingGameName ? 'Edit Game' : 'Add Game'}</h2>

            {/* Game Type Toggle */}
            {!editingGameName && (
              <div className="game-type-toggle">
                <button
                  className={`game-type-btn ${gameType === 'executable' ? 'active' : ''}`}
                  onClick={() => setGameType('executable')}
                >
                  Executable
                </button>
                <button
                  className={`game-type-btn ${gameType === 'rom' ? 'active' : ''}`}
                  onClick={() => setGameType('rom')}
                >
                  ROM File
                </button>
              </div>
            )}

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

            {/* ROM File Selector */}
            {gameType === 'rom' && (
              <>
                <label>ROM File</label>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input
                    type="text"
                    placeholder="Select a ROM file..."
                    value={romFile ? `${romFile.name}.${romFile.ext}` : ''}
                    readOnly
                    style={{ flex: 1 }}
                  />
                  <input
                    ref={romFileInputRef}
                    type="file"
                    accept=".nes,.sfc,.smc,.gba,.gb,.gbc,.gen,.md,.sms,.gg,.pce,.ngp,.ngpc,.ws,.wsc,.lnx,.jag,.vb,.col,.sg"
                    style={{ display: 'none' }}
                    onChange={handleRomFileSelectForAdd}
                  />
                  <button
                    className="modal-btn"
                    onClick={() => romFileInputRef.current?.click()}
                    style={{ padding: '0 15px', fontSize: 20 }}
                  >
                    +
                  </button>
                </div>
                {romFile && (
                  <div style={{ fontSize: '0.7rem', color: '#107c10', marginTop: -8, marginBottom: 5 }}>
                    System: {romFile.systemName} ({romFile.ext.toUpperCase()})
                  </div>
                )}
              </>
            )}

            {/* Executable Path */}
            {gameType === 'executable' && (
              <>
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
              </>
            )}

            <label>Cover Art</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type="text"
                placeholder="Paste image URL or select a file"
                value={previewIcon || ''}
                onChange={(e) => setPreviewIcon(e.target.value || null)}
                style={{ flex: 1 }}
              />
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
              <input
                type="text"
                placeholder="Paste image URL or select a file"
                value={previewBanner || ''}
                onChange={(e) => setPreviewBanner(e.target.value || null)}
                style={{ flex: 1 }}
              />
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
