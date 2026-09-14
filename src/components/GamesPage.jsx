import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getIpcRenderer, getNodeChildProcess, getNodePath } from '../utils/electron'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')

const defaultGames = []

export default function GamesPage() {
  const { config, updateConfig } = useConfig()
  const games = config.myGames

  const setGames = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('myGames', newVal(games))
    } else {
      updateConfig('myGames', newVal)
    }
  }

  useEffect(() => {
    window.dispatchEvent(new Event('games-updated'))
  }, [games])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showMyGames, setShowMyGames] = useState(false)
  const [isClosingMyGames, setIsClosingMyGames] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [newGameExe, setNewGameExe] = useState('')
  const [newGameIcon, setNewGameIcon] = useState(null)
  const [newGameBanner, setNewGameBanner] = useState(null)
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        setOnlineSearchResults(parsed)
      } else {
        setOnlineSearchResults([{ id: 'none', name: 'No games found' }])
      }
    } catch (e) {
      setOnlineSearchResults([{ id: 'none', name: 'Search Failed' }])
    }
  }

  const applyOnlineGame = async (gameItem) => {
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
        ...g,
        name: newGameName,
        exe: newGameExe,
        icon: previewIcon ? iconUrl : g.icon,
        banner: previewBanner ? bannerUrl : (previewIcon ? iconUrl : g.banner)
      } : g))
    } else {
      setGames([...games, {
        name: newGameName,
        exe: newGameExe,
        icon: iconUrl,
        banner: bannerUrl,
        stars: 5,
        isPinned: false,
        lastPlayed: 0
      }])
    }

    setNewGameName('')
    setNewGameExe('')
    setNewGameIcon(null)
    setNewGameBanner(null)
    setPreviewIcon(null)
    setPreviewBanner(null)
    setEditingGameName(null)
    setShowAddModal(false)
  }

  const launchGame = (game) => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => { })

    setGames(prev => prev.map(g => g.name === game.name ? { ...g, lastPlayed: Date.now() } : g))

    if (game.exe && isElectron()) {
      try {
        const exec = getNodeChildProcess()
        const path = getNodePath()
        if (exec && path) {
          const cwd = path.dirname(game.exe)
          exec(`start "" "${game.exe}"`, { cwd }, (err) => {
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
    hoverAudio.play().catch(() => { })
  }

  const closeMyGames = () => {
    backAudio.currentTime = 0
    backAudio.play().catch(() => { })
    setIsClosingMyGames(true)
    setTimeout(() => {
      setShowMyGames(false)
      setIsClosingMyGames(false)
    }, 300)
  }

  const openMyGames = () => {
    selectAudio.currentTime = 0
    selectAudio.play().catch(() => { })
    setShowMyGames(true)
  }

  const renderStars = (count) => {
    const c = count || 0
    return '★'.repeat(c) + '☆'.repeat(5 - c)
  }

  const handleIconFile = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPreviewIcon(URL.createObjectURL(file))
    }
  }

  const handleBannerFile = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPreviewBanner(URL.createObjectURL(file))
    }
  }

  const handleExeFile = async (e) => {
    const file = e.target.files[0]
    if (file) {
      if (isElectron()) {
        setNewGameExe(file.path)
      } else {
        setNewGameExe(file.name)
      }
    }
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
            label="Add Games"
            icon={<img src="./assets/icons/add_apps.png" alt="Add Games" />}
            onClick={() => {
              setEditingGameName(null)
              setNewGameName('')
              setNewGameExe('')
              setPreviewIcon(null)
              setPreviewBanner(null)
              setShowAddModal(true)
            }}
          />
        </div>

        <div className="games-center">
          {games.length > 0 ? (
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
          {games.length > 1 ? (
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
          {games.length > 2 ? (
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
          {games.length > 3 ? (
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
          {games.length > 4 ? (
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
