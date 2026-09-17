import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import { useConfig } from '../context/ConfigContext'
import { useMusic } from '../context/MusicContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath, browserBasenameNoExt, toFileUrl } from '../utils/electron'

export default function MusicPage({ isActive }) {
  const { config, updateConfig } = useConfig()
  const pinnedTracks = config.pinnedTracks
  const customMusicCovers = config.customMusicCovers
  const musicFolder = config.musicFolder

  const {
    playlist, setPlaylist,
    currentTrack, currentTrackIndex, setCurrentTrackIndex,
    isPlaying,
    currentTime, duration,
    volume, isMuted,
    formatTime,
    togglePlay, next, prev, seek,
    setVolume, toggleMute, playTrackByName,
  } = useMusic()

  const [showList, setShowList] = useState(false)
  const [currentCover, setCurrentCover] = useState(null)

  const folderInputRef = useRef(null)
  const coverFileInputRef = useRef(null)

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

  // Electron: scan folder from filesystem
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
            } else if (/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file)) {
              fileList.push(filePath)
            }
          }
          return fileList
        }

        if (fs.existsSync(musicFolder)) {
          const musicFiles = getFilesRecursively(musicFolder)
          const tracks = musicFiles.map(fp => {
            const name = browserBasenameNoExt(fp)
            const url = toFileUrl(fp)
            return {
              id: fp,
              name,
              path: fp,
              url,
              artist: '',
              album: '',
              genre: '',
              duration: 0,
              cover: '',
              isPinned: pinnedTracks.includes(fp),
            }
          })
          setPlaylist(tracks)
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

  const handleFolderInput = async (e) => {
    const files = Array.from(e.target.files)
      .filter(f => /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name))

    const tracks = await Promise.all(files.map(async (file) => {
      const url = URL.createObjectURL(file)
      const name = file.name.replace(/\.[^.]+$/, '')
      let artist = '', album = '', genre = '', duration = 0, cover = ''

      try {
        const { parseBlob } = await import('music-metadata')
        const meta = await parseBlob(file)
        artist = meta.common.artist || ''
        album = meta.common.album || ''
        genre = meta.common.genre?.[0] || ''
        duration = meta.format.duration || 0
        if (meta.common.picture?.[0]) {
          const pic = meta.common.picture[0]
          cover = URL.createObjectURL(new Blob([pic.data], { type: pic.format }))
        }
      } catch {}

      return {
        id: url,
        name,
        path: file.webkitRelativePath || file.name,
        url,
        artist,
        album,
        genre,
        duration,
        cover,
        isPinned: false,
      }
    }))

    setPlaylist(tracks)
    setMusicFolder(e.target.files[0]?.webkitRelativePath?.split('/')[0] || 'Music')
  }

  const playTrack = (index) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentTrackIndex(index)
    }
  }

  const playTileMusic = (filePath) => {
    if (!filePath) return
    const track = playlist.find(t => t.path === filePath)
    if (track) {
      playTrackByName(track.path)
    } else {
      const newTrack = {
        id: filePath,
        name: filePath.split('/').pop().split('\\').pop().replace(/\.[^.]+$/, ''),
        path: filePath,
        url: isElectron() ? toFileUrl(filePath) : '',
        artist: '', album: '', genre: '', duration: 0, cover: '', isPinned: false,
      }
      setPlaylist(prev => [...prev, newTrack])
      playTrackByName(newTrack.path)
    }
  }

  const displayTracks = useMemo(() => {
    const pinned = [...pinnedTracks]
    const availableRandom = playlist.filter(p => !pinned.includes(p.path))
    const shuffled = availableRandom.sort(() => 0.5 - Math.random())
    const combined = [...pinned.map(p => playlist.find(t => t.path === p)).filter(Boolean), ...shuffled].slice(0, 10)

    return combined.map(t => ({
      ...t,
      isPinned: pinned.includes(t.path),
      cover: customMusicCovers[t.path] || t.cover || '',
    }))
  }, [pinnedTracks, playlist, customMusicCovers])

  const togglePinTrack = (trackPath, e) => {
    e.stopPropagation()
    setPinnedTracks(prev => prev.includes(trackPath) ? prev.filter(p => p !== trackPath) : [...prev, trackPath])
  }

  useEffect(() => {
    if (!isActive) {
      setShowList(false)
      setEditingMusicPath(null)
    }
  }, [isActive])

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
    const coverUrl = customMusicCovers[track.path] || track.cover || ''
    return (
      <Tile
        label={track.name}
        icon={<img src="./assets/icons/Music.png" alt="Track" />}
        style={coverUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url("${coverUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        onClick={() => playTileMusic(track.path)}
        onContextMenu={(e) => {
          if (track.isPinned) handleMusicContextMenu(e, track.path)
        }}
      />
    )
  }

  const trackName = currentTrack?.name || 'No music playing'
  const trackCover = currentTrack ? (customMusicCovers[currentTrack.path] || currentTrack.cover || '') : ''
  const trackArtist = currentTrack?.artist || ''

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
            <Tile label="Track" />
          </div>
        ))}
      </div>

      <div className="music-player-container">
        <div className="music-player-bar">
          <button className="music-btn" onClick={prev}>
            <img src="./assets/icons/previous.png" alt="Prev" style={{ width: 24, height: 24 }} />
          </button>
          <button className="music-btn" onClick={togglePlay}>
            <img src={isPlaying ? "./assets/icons/stop.png" : "./assets/icons/play.png"} alt="Play/Stop" style={{ width: 24, height: 24 }} />
          </button>
          <button className="music-btn" onClick={next}>
            <img src="./assets/icons/next.png" alt="Next" style={{ width: 24, height: 24 }} />
          </button>

          <span className="music-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="music-seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
          />
          <span className="music-time">{formatTime(duration)}</span>

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
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />

          <div className="music-now-playing">
            {trackCover ? (
              <img src={trackCover} alt="" className="music-now-playing-cover" />
            ) : (
              <div className="music-now-playing-cover music-now-playing-placeholder">
                <img src="./assets/icons/Music.png" alt="" style={{ width: 24, height: 24 }} />
              </div>
            )}
            <div className="music-track-info">
              <div className="music-track-name">{trackName}</div>
              {trackArtist && <div className="music-track-artist">{trackArtist}</div>}
            </div>
          </div>
        </div>
      </div>

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
                {playlist.map((track, index) => {
                  const isPinned = pinnedTracks.includes(track.path)
                  return (
                    <div key={track.id} className="video-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div onClick={() => playTrack(index)} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <img src="./assets/icons/Music.png" alt="music" style={{ width: 16, height: 16, marginRight: 8 }} />
                        <span className="video-list-name" style={{ color: index === currentTrackIndex ? '#108710' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{track.name}</span>
                        {track.artist && <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: 8 }}>{track.artist}</span>}
                      </div>
                      <button className="modal-btn" style={{ padding: '2px 10px', fontSize: '12px', height: 'auto', backgroundColor: isPinned ? '#ff4444' : '#107c10' }} onClick={(e) => togglePinTrack(track.path, e)}>
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

            <div className="modal-actions" style={{ marginTop: 20 }}>
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
