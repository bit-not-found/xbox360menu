import { useState, useEffect, useRef, useCallback } from 'react'
import Tile from './Tile'
import MusicCollectionPage from './MusicCollectionPage'
import AudioVisualizer from './AudioVisualizer'
import FullscreenPlayer from './FullscreenPlayer'
import { useConfig } from '../context/ConfigContext'
import { useMusic } from '../context/MusicContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath, browserBasenameNoExt, toFileUrl } from '../utils/electron'

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
    setVolume, toggleMute,
    addToQueue, playNext, playAlbum,
    getAudioContext, getAnalyser, connectAudioSource,
  } = useMusic()

  const [activeView, setActiveView] = useState(null)
  const [showVisualizer, setShowVisualizer] = useState(false)
  const [inlineVizActive, setInlineVizActive] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)

  const folderInputRef = useRef(null)
  const songsInputRef = useRef(null)
  const inlineCanvasRef = useRef(null)
  const inlineAnimRef = useRef(null)

  useEffect(() => {
    if (!inlineVizActive || !inlineCanvasRef.current) {
      if (inlineAnimRef.current) {
        cancelAnimationFrame(inlineAnimRef.current)
        inlineAnimRef.current = null
      }
      return
    }

    connectAudioSource()
    const analyser = getAnalyser()
    if (!analyser) return

    const canvas = inlineCanvasRef.current
    const ctx = canvas.getContext('2d')
    const wrap = canvas.parentElement
    if (!wrap) return

    const dpr = window.devicePixelRatio || 1
    let w, h

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const barCount = 64
    const gap = 2

    const render = () => {
      inlineAnimRef.current = requestAnimationFrame(render)

      ctx.clearRect(0, 0, w, h)

      analyser.getByteFrequencyData(dataArray)

      const barWidth = (w - gap * (barCount - 1)) / barCount
      const step = Math.floor(bufferLength / barCount)

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step]
        const barHeight = (value / 255) * h * 0.85
        const x = i * (barWidth + gap)
        const y = h - barHeight

        const hue = 120 + (i / barCount) * 60
        const lightness = 35 + (value / 255) * 25
        ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, 0.85)`
        ctx.fillRect(x, y, barWidth, barHeight)

        const glowAlpha = (value / 255) * 0.4
        ctx.fillStyle = `hsla(${hue}, 80%, 55%, ${glowAlpha})`
        ctx.fillRect(x, y - 2, barWidth, 3)
      }
    }

    render()

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    return () => {
      if (inlineAnimRef.current) {
        cancelAnimationFrame(inlineAnimRef.current)
        inlineAnimRef.current = null
      }
      ro.disconnect()
    }
  }, [inlineVizActive, getAudioContext, getAnalyser, connectAudioSource])

  const toggleInlineViz = useCallback(() => {
    setInlineVizActive(prev => !prev)
  }, [])

  const handleFullscreenNavigate = useCallback((viewId) => {
    setShowFullscreen(false)
    setActiveView(viewId)
  }, [])

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
      setShowFullscreen(false)
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

        <div className="music-center">
          <Tile
            className="music-center-tile"
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

            {inlineVizActive && (
              <div className="music-inline-viz-wrap">
                <canvas ref={inlineCanvasRef} className="music-inline-viz-canvas" />
              </div>
            )}

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
                <div
                  className="music-now-playing"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { if (currentTrack) setShowFullscreen(true) }}
                >
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
              </div>
            </div>
          </Tile>
        </div>

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

      {showFullscreen && (
        <FullscreenPlayer
          onClose={() => setShowFullscreen(false)}
          isActive={isActive}
          onNavigate={handleFullscreenNavigate}
          customMusicCovers={customMusicCovers}
        />
      )}
    </>
  )
}
