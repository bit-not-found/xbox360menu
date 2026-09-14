import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath, browserBasenameNoExt, toFileUrl } from '../utils/electron'

export default function MusicPage() {
  const { config, updateConfig } = useConfig()
  const pinnedTracks = config.pinnedTracks
  const customMusicCovers = config.customMusicCovers
  const musicFolder = config.musicFolder

  const setPinnedTracks = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('pinnedTracks', newVal(pinnedTracks))
    } else {
      updateConfig('pinnedTracks', newVal)
    }
  }

  const setCustomMusicCovers = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('customMusicCovers', newVal(customMusicCovers))
    } else {
      updateConfig('customMusicCovers', newVal)
    }
  }

  const setMusicFolder = (newVal) => {
    updateConfig('musicFolder', newVal)
  }
  const [playlist, setPlaylist] = useState([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showList, setShowList] = useState(false)
  const [currentCover, setCurrentCover] = useState(null)

  const audioRef = useRef(null)
  const folderInputRef = useRef(null)
  const coverFileInputRef = useRef(null)

  useEffect(() => {
    if (musicFolder && isElectron()) {
      try {
        const fs = getNodeFs()
        const path = getNodePath()
        if (!fs || !path) return
        
        const getFilesRecursively = (dir, fileList = []) => {
          const files = fs.readdirSync(dir)
          for (const file of files) {
            const filePath = path.join(dir, file)
            if (fs.statSync(filePath).isDirectory()) {
              getFilesRecursively(filePath, fileList)
            } else if (/\.(mp3|wav|ogg|flac)$/i.test(file)) {
              fileList.push(filePath)
            }
          }
          return fileList
        }

        if (fs.existsSync(musicFolder)) {
          const musicFiles = getFilesRecursively(musicFolder)
          setPlaylist(musicFiles)
        }
      } catch (e) {
        console.error('Failed to read music folder', e)
      }
    }
  }, [musicFolder])

  const selectFolder = async () => {
    if (isElectron()) {
      try {
        const ipcRenderer = getIpcRenderer()
        const result = await ipcRenderer.invoke('dialog:openDirectory')
        if (result && !result.canceled && result.filePaths.length > 0) {
          const folderPath = result.filePaths[0]
          setMusicFolder(folderPath)
          localStorage.setItem('musicFolder', folderPath)
        }
      } catch (e) {
        console.error('Folder selection failed via IPC', e)
      }
    } else {
      folderInputRef.current?.click()
    }
  }

  const handleFolderInput = (e) => {
    const files = Array.from(e.target.files)
    const audioFiles = files
      .filter(f => /\.(mp3|wav|ogg|flac)$/i.test(f.name))
      .map(f => f.webkitRelativePath || f.name)
    setPlaylist(audioFiles)
    setMusicFolder(e.target.files[0]?.webkitRelativePath?.split('/')[0] || 'Music')
  }

  const playTrack = (index) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentTrackIndex(index)
      setIsPlaying(true)
    }
  }

  const playTileMusic = (filePath) => {
    if (!filePath) return
    const index = playlist.findIndex(p => p === filePath)
    
    if (index !== -1) {
      playTrack(index)
    } else {
      const newPlaylist = [...playlist, filePath]
      setPlaylist(newPlaylist)
      setCurrentTrackIndex(newPlaylist.length - 1)
      setIsPlaying(true)
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (currentTrackIndex === -1 && playlist.length > 0) {
        setCurrentTrackIndex(0)
      } else {
        audioRef.current.play().catch(e => console.error(e))
      }
      setIsPlaying(true)
    }
  }

  const playNext = () => {
    if (playlist.length === 0) return
    const nextIndex = (currentTrackIndex + 1) % playlist.length
    playTrack(nextIndex)
  }

  const playPrev = () => {
    if (playlist.length === 0) return
    const prevIndex = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1
    playTrack(prevIndex)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) {
      audioRef.current.volume = val
      if (val > 0 && isMuted) {
        setIsMuted(false)
        audioRef.current.muted = false
      }
    }
  }

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.play().catch(e => console.error("Playback error:", e))
    }
  }, [isPlaying, currentTrackIndex])

  useEffect(() => {
    if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
      const trackPath = playlist[currentTrackIndex];
      const cover = customMusicCovers[trackPath] || null;
      setCurrentCover(cover);
    } else {
      setCurrentCover(null);
    }
  }, [currentTrackIndex, playlist, customMusicCovers])

  const [displayTracks, setDisplayTracks] = useState([])

  useEffect(() => {
    const pinned = [...pinnedTracks]
    const availableRandom = playlist.filter(p => !pinned.includes(p))
    const shuffled = availableRandom.sort(() => 0.5 - Math.random())
    const combined = [...pinned, ...shuffled].slice(0, 10)
    
    const results = combined.map(t => {
      const name = isElectron() ? (() => {
        const path = getNodePath()
        return path ? browserBasenameNoExt(t) : t.split('/').pop().split('\\').pop().replace(/\.[^.]+$/, '')
      })() : t.split('/').pop().replace(/\.[^.]+$/, '')
      
      return {
        path: t,
        name: name,
        cover: customMusicCovers[t] || '',
        isPinned: pinned.includes(t)
      }
    })
    setDisplayTracks(results)
  }, [pinnedTracks, playlist, customMusicCovers])

  const togglePinTrack = (trackPath, e) => {
    e.stopPropagation()
    setPinnedTracks(prev => prev.includes(trackPath) ? prev.filter(p => p !== trackPath) : [...prev, trackPath])
  }

  const handleEnded = () => {
    playNext()
  }

  const [editingMusicPath, setEditingMusicPath] = useState(null)
  const [editMusicCover, setEditMusicCover] = useState('')

  const handleMusicContextMenu = (e, path) => {
    e.preventDefault()
    setEditingMusicPath(path)
    setEditMusicCover(customMusicCovers[path] || '')
  }

  const saveMusicCover = () => {
    setCustomMusicCovers(prev => ({ ...prev, [editingMusicPath]: editMusicCover }))
    setEditingMusicPath(null)
  }

  const renderMusicTile = (track) => {
    if (!track) return <Tile />
    return (
      <Tile 
        label={track.name}
        icon={<img src="./assets/icons/Music.png" alt="Track" />}
        style={track.cover ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url("${track.cover}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        onClick={() => playTileMusic(track.path)}
        onContextMenu={(e) => {
          if (track.isPinned) {
             handleMusicContextMenu(e, track.path)
          }
        }}
      />
    )
  }

  let currentTrackName = 'No music playing'
  let currentTrackUrl = ''
  if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
    const trackPath = playlist[currentTrackIndex]
    if (isElectron()) {
      currentTrackName = browserBasenameNoExt(trackPath)
      currentTrackUrl = toFileUrl(trackPath)
    } else {
      currentTrackName = trackPath.split('/').pop().replace(/\.[^.]+$/, '')
      currentTrackUrl = ''
    }
  }

  return (
    <>
      <div className="music-grid">
        <div className="music-tile-wrapper" style={{ gridColumn: 1, gridRow: 1 }}>
          <Tile label="My Musics" icon={<img src="./assets/icons/Music.png" alt="My Musics" />} onClick={() => setShowList(true)} />
        </div>
        <div className="music-tile-wrapper" style={{ gridColumn: 1, gridRow: 2 }}>
          <Tile label="Music Folder" icon={<img src="./assets/icons/Folder.png" alt="Music Folder" />} onClick={selectFolder} />
        </div>

        {displayTracks.map((track, i) => (
          <div className="music-tile-wrapper" key={`t${i}`}>
             {renderMusicTile(track)}
          </div>
        ))}
        {Array.from({ length: 10 - displayTracks.length }).map((_, i) => (
          <div className="music-tile-wrapper" key={`empty${i}`}>
             <Tile label={`Track`} />
          </div>
        ))}
      </div>

      <div className="music-player-container">
        <div className="music-player-bar">
          <button className="music-btn" onClick={playPrev}>
            <img src="./assets/icons/previous.png" alt="Prev" style={{ width: 24, height: 24 }} />
          </button>
          <button className="music-btn" onClick={togglePlay}>
            <img src={isPlaying ? "./assets/icons/stop.png" : "./assets/icons/play.png"} alt="Play/Stop" style={{ width: 24, height: 24 }} />
          </button>
          <button className="music-btn" onClick={playNext}>
            <img src="./assets/icons/next.png" alt="Next" style={{ width: 24, height: 24 }} />
          </button>
          <button className="music-btn" onClick={toggleMute} style={{ opacity: isMuted || volume === 0 ? 0.5 : 1 }}>
            <img src="./assets/icons/Volume.png" alt="Volume" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </button>
          <input 
            type="range" 
            className="volume-slider" 
            min="0" 
            max="1" 
            step="0.01" 
            value={isMuted ? 0 : volume} 
            onChange={handleVolumeChange} 
          />
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 15 }}>
            {currentCover ? (
              <img src={currentCover} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="./assets/icons/Music.png" alt="" style={{ width: 24, height: 24 }} />
              </div>
            )}
            <div className="music-track-info" style={{ marginLeft: 10 }}>{currentTrackName}</div>
          </div>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        src={currentTrackUrl} 
        onEnded={handleEnded} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)}
      />

      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={handleFolderInput} accept="audio/*" />

      {/* Playlist Modal */}
      {showList && createPortal(
        <div className="modal-overlay">
          <div className="modal-content video-list-modal" onClick={(e) => e.stopPropagation()}>
            <h2>My Musics</h2>
            {playlist.length === 0 ? (
              <p className="video-empty">No music found. Select a Music Folder to load songs.</p>
            ) : (
              <div className="video-list-items">
                {playlist.map((trackPath, index) => {
                  const name = trackPath.split('/').pop().split('\\').pop().replace(/\.[^.]+$/, '')
                  const isPinned = pinnedTracks.includes(trackPath)
                  return (
                    <div key={trackPath} className="video-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div onClick={() => playTrack(index)} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <img src="./assets/icons/Music.png" alt="music" style={{ width: 16, height: 16, marginRight: 8 }} />
                        <span className="video-list-name" style={{ color: index === currentTrackIndex ? '#108710' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{name}</span>
                      </div>
                      <button className="modal-btn" style={{ padding: '2px 10px', fontSize: '12px', height: 'auto', backgroundColor: isPinned ? '#ff4444' : '#107c10' }} onClick={(e) => togglePinTrack(trackPath, e)}>
                        {isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowList(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Editing Modal for Custom Covers */}
      {editingMusicPath && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Customize Pinned Music</h2>

            <label>Cover Image Path (optional)</label>
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              <input 
                type="text" 
                placeholder="Enter image URL or select a file" 
                value={editMusicCover} 
                onChange={(e) => setEditMusicCover(e.target.value)} 
                style={{ flex: 1 }}
              />
              {isElectron() ? (
                <button className="modal-btn" onClick={async () => {
                  const ipcRenderer = getIpcRenderer()
                  const res = await ipcRenderer.invoke('dialog:openFile', { filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'webp'] }] })
                  if (res && !res.canceled && res.filePaths.length > 0) {
                    let fp = res.filePaths[0].replace(/\\/g, '/')
                    if (fp.match(/^[a-zA-Z]:/)) fp = `file:///${fp}`
                    setEditMusicCover(fp)
                  }
                }} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
              ) : (
                <>
                  <input ref={coverFileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) setEditMusicCover(URL.createObjectURL(file))
                  }} accept="image/*" />
                  <button className="modal-btn" onClick={() => coverFileInputRef.current?.click()} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
                </>
              )}
            </div>

            <div className="modal-actions" style={{marginTop: 20}}>
              <button className="modal-btn cancel" onClick={() => setEditingMusicPath(null)}>Cancel</button>
              <button className="modal-btn confirm" onClick={saveMusicCover}>Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
