import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import MusicCollectionPage from './MusicCollectionPage'
import AudioVisualizer from './AudioVisualizer'
import { useConfig } from '../context/ConfigContext'
import { useMusic } from '../context/MusicContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath, browserBasenameNoExt, toFileUrl } from '../utils/electron'

let butterchurnLib = null
let butterchurnPresetsLib = null

export default function MusicPage({ isActive }) {
  const { config, updateConfig } = useConfig()
  const pinnedTracks = config.pinnedTracks
  const customMusicCovers = config.customMusicCovers
  const musicFolder = config.musicFolder

  const {
    playlist, setPlaylist, appendPlaylist,
    currentTrack, currentTrackIndex, setCurrentTrackIndex,
    isPlaying,
    currentTime, duration,
    volume, isMuted,
    formatTime,
    togglePlay, next, prev, seek,
    setVolume, toggleMute, playTrackByName,
    addToQueue, playNext, playAlbum,
    getAudioContext, getAnalyser,
  } = useMusic()

  const [activeView, setActiveView] = useState(null)
  const [showVisualizer, setShowVisualizer] = useState(false)
  const [inlineVizActive, setInlineVizActive] = useState(false)

  const folderInputRef = useRef(null)
  const songsInputRef = useRef(null)
  const inlineCanvasRef = useRef(null)
  const inlineVizRef = useRef(null)
  const inlineAnimRef = useRef(null)
  const [inlinePreset, setInlinePreset] = useState('')
  const [inlinePresetList, setInlinePresetList] = useState([])

  // Load butterchurn for inline visualizer
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [bc, bcp] = await Promise.all([
          import('butterchurn'),
          import('butterchurn-presets'),
        ])
        if (cancelled) return
        butterchurnLib = bc.default || bc
        butterchurnPresetsLib = bcp.default || bcp
        const presets = butterchurnPresetsLib.getPresets()
        const names = Object.keys(presets)
        setInlinePresetList(names)
        if (names.length > 0) {
          setInlinePreset(names[Math.floor(Math.random() * names.length)])
        }
      } catch (e) {
        console.error('Failed to load butterchurn for inline viz:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Initialize/destroy inline visualizer
  useEffect(() => {
    if (!inlineVizActive || !inlineCanvasRef.current || !butterchurnLib || !inlinePreset) {
      if (inlineAnimRef.current) {
        cancelAnimationFrame(inlineAnimRef.current)
        inlineAnimRef.current = null
      }
      inlineVizRef.current = null
      return
    }

    const canvas = inlineCanvasRef.current
    const wrap = canvas.parentElement
    if (!wrap) return

    const rect = wrap.getBoundingClientRect()

    try {
      const createViz = butterchurnLib.default || butterchurnLib
      const viz = createViz(getAudioContext(), canvas, {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      })

      const presets = butterchurnPresetsLib.getPresets()
      viz.loadPreset(presets[inlinePreset], 0.0)
      viz.setRendererSize(Math.floor(rect.width), Math.floor(rect.height))

      const analyser = getAnalyser()
      if (analyser) {
        viz.connectAudio(analyser)
      }

      inlineVizRef.current = viz

      const renderLoop = () => {
        if (inlineVizRef.current) {
          try {
            inlineVizRef.current.render()
          } catch {}
        }
        inlineAnimRef.current = requestAnimationFrame(renderLoop)
      }
      renderLoop()
    } catch (e) {
      console.error('Failed to create inline visualizer:', e)
    }

    return () => {
      if (inlineAnimRef.current) {
        cancelAnimationFrame(inlineAnimRef.current)
        inlineAnimRef.current = null
      }
      inlineVizRef.current = null
    }
  }, [inlineVizActive, inlinePreset, getAudioContext, getAnalyser])

  // Handle resize for inline visualizer
  useEffect(() => {
    const handleResize = () => {
      if (!inlineCanvasRef.current || !inlineVizRef.current) return
      const wrap = inlineCanvasRef.current.parentElement
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      inlineCanvasRef.current.width = w
      inlineCanvasRef.current.height = h
      try {
        inlineVizRef.current.setRendererSize(w, h)
      } catch {}
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleInlineViz = useCallback(() => {
    setInlineVizActive(prev => !prev)
  }, [])

  const randomInlinePreset = useCallback(() => {
    if (inlinePresetList.length === 0) return
    const idx = Math.floor(Math.random() * inlinePresetList.length)
    setInlinePreset(inlinePresetList[idx])
  }, [inlinePresetList])

  const setPinnedTracks = useCallback((newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('pinnedTracks', newVal(pinnedTracks))
    } else {
      updateConfig('pinnedTracks', newVal)
    }
  }, [pinnedTracks, updateConfig])

  const setCustomMusicCovers = useCallback((newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('customMusicCovers', newVal(customMusicCovers))
    } else {
      updateConfig('customMusicCovers', newVal)
    }
  }, [customMusicCovers, updateConfig])

  const setMusicFolder = useCallback((newVal) => {
    updateConfig('musicFolder', newVal)
  }, [updateConfig])

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

  const handleAddSongs = async (e) => {
    const files = Array.from(e.target.files)
      .filter(f => /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name))

    if (files.length === 0) return

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

    appendPlaylist(tracks)
    e.target.value = ''
  }

  useEffect(() => {
    if (!isActive) {
      setActiveView(null)
      setShowVisualizer(false)
    }
  }, [isActive])

  const getCoverUrl = (track) => {
    if (!track) return ''
    return customMusicCovers[track.path] || track.cover || ''
  }

  const getTileCover = () => {
    const pinned = playlist.filter(t => pinnedTracks.includes(t.path))
    const fallback = pinned.length > 0 ? pinned[0] : playlist[0]
    return fallback ? getCoverUrl(fallback) : ''
  }

  const trackName = currentTrack?.name || 'No music playing'
  const trackCover = currentTrack ? getCoverUrl(currentTrack) : ''
  const trackArtist = currentTrack?.artist || ''

  const tileCover = getTileCover()

  return (
    <>
      <div className="music-grid">
        {/* Column 1 - Left */}
        <div className="music-c1-r1">
          <Tile
            label="Artists"
            icon={<img src="./assets/icons/Music.png" alt="Artists" />}
            onClick={() => setActiveView('artists')}
          />
        </div>
        <div className="music-c1-r2">
          <Tile
            label="Albums"
            icon={<img src="./assets/icons/Music.png" alt="Albums" />}
            onClick={() => setActiveView('albums')}
          />
        </div>
        <div className="music-c1-r3">
          <Tile
            label="Songs"
            icon={<img src="./assets/icons/Music.png" alt="Songs" />}
            onClick={() => setActiveView('songs')}
          />
        </div>

        {/* Center - ONE big tile (My Music, same as home center) */}
        <div className="music-center">
          <Tile
            label="My Music"
            icon={<img src="./assets/icons/Music.png" alt="My Music" />}
            style={tileCover ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url("${tileCover}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : {}}
            onClick={() => setActiveView('songs')}
          >
            {playlist.length === 0 && (
              <div className="music-center-actions">
                <button
                  className="music-center-action-btn"
                  onClick={(e) => { e.stopPropagation(); selectFolder() }}
                >
                  + Add Folder
                </button>
                <button
                  className="music-center-action-btn"
                  onClick={(e) => { e.stopPropagation(); songsInputRef.current?.click() }}
                >
                  + Add Song
                </button>
              </div>
            )}

            {/* Inline visualizer canvas */}
            {inlineVizActive && (
              <div className="music-inline-viz-wrap">
                <canvas ref={inlineCanvasRef} className="music-inline-viz-canvas" />
              </div>
            )}

            {/* Player bar inside the tile */}
            <div className="music-tile-player" onClick={(e) => e.stopPropagation()}>
              <div className="music-tile-player-controls">
                <button className="music-btn" onClick={prev}>
                  <img src="./assets/icons/previous.png" alt="Prev" style={{ width: 20, height: 20 }} />
                </button>
                <button className="music-btn" onClick={togglePlay}>
                  <img src={isPlaying ? "./assets/icons/stop.png" : "./assets/icons/play.png"} alt="Play/Stop" style={{ width: 20, height: 20 }} />
                </button>
                <button className="music-btn" onClick={next}>
                  <img src="./assets/icons/next.png" alt="Next" style={{ width: 20, height: 20 }} />
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
                  <img src="./assets/icons/Volume.png" alt="Volume" style={{ width: 24, height: 24, objectFit: 'contain' }} />
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
              </div>

              <div className="music-tile-player-right">
                <div className="music-now-playing">
                  {trackCover ? (
                    <img src={trackCover} alt="" className="music-now-playing-cover" />
                  ) : (
                    <div className="music-now-playing-cover music-now-playing-placeholder">
                      <img src="./assets/icons/Music.png" alt="" style={{ width: 20, height: 20 }} />
                    </div>
                  )}
                  <div className="music-track-info">
                    <div className="music-track-name">{trackName}</div>
                    {trackArtist && <div className="music-track-artist">{trackArtist}</div>}
                  </div>
                </div>

                <button
                  className={`music-viz-toggle ${inlineVizActive ? 'active' : ''}`}
                  onClick={toggleInlineViz}
                  title="Toggle Visualizer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="10" width="2" height="4" rx="1" />
                    <rect x="6" y="6" width="2" height="12" rx="1" />
                    <rect x="10" y="2" width="2" height="20" rx="1" />
                    <rect x="14" y="6" width="2" height="12" rx="1" />
                    <rect x="18" y="10" width="2" height="4" rx="1" />
                  </svg>
                </button>
                {inlineVizActive && (
                  <button
                    className="music-viz-toggle"
                    onClick={randomInlinePreset}
                    title="Random Preset"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
                      <path d="m18 2 4 4-4 4" />
                      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
                      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
                      <path d="m18 14 4 4-4 4" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </Tile>
        </div>

        {/* Bottom middle tiles */}
        <div className="music-c2-r3">
          <Tile
            label="Recently Added"
            icon={<img src="./assets/icons/Music.png" alt="Recently Added" />}
            onClick={() => setActiveView('recentlyAdded')}
          />
        </div>
        <div className="music-c3-r3">
          <Tile
            label="Smart Mixes"
            icon={<img src="./assets/icons/Music.png" alt="Smart Mixes" />}
            onClick={() => setActiveView('smartMixes')}
          />
        </div>

        {/* Column 4 - Right */}
        <div className="music-c4-r1">
          <Tile
            label="Genres"
            icon={<img src="./assets/icons/Music.png" alt="Genres" />}
            onClick={() => setActiveView('genres')}
          />
        </div>
        <div className="music-c4-r2">
          <Tile
            label="Playlists"
            icon={<img src="./assets/icons/Music.png" alt="Playlists" />}
            onClick={() => setActiveView('playlists')}
          />
        </div>
        <div className="music-c4-r3">
          <Tile
            label="Favorites"
            icon={<img src="./assets/icons/Music.png" alt="Favorites" />}
            onClick={() => setActiveView('favorites')}
          />
        </div>
      </div>

      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={handleFolderInput} accept="audio/*" />
      <input ref={songsInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAddSongs} accept="audio/*" />

      {activeView && (
        <MusicCollectionPage
          view={activeView}
          playlist={playlist}
          onClose={() => setActiveView(null)}
          isActive={isActive}
          config={config}
          updateConfig={updateConfig}
          customMusicCovers={customMusicCovers}
          onPlayTrack={(idx) => setCurrentTrackIndex(idx)}
          onPlayAlbum={(tracks, shuffle) => playAlbum(tracks, shuffle)}
          onAddToQueue={(track) => addToQueue(track)}
          onPlayNext={(track) => playNext(track)}
          onAddFolder={selectFolder}
          onAddSong={() => songsInputRef.current?.click()}
        />
      )}

      {showVisualizer && (
        <AudioVisualizer onClose={() => setShowVisualizer(false)} isActive={isActive} />
      )}
    </>
  )
}
