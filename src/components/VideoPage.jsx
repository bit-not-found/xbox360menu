import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import CollectionPage from './CollectionPage'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath } from '../utils/electron'

export default function VideoPage({ isActive }) {
  const { config, updateConfig } = useConfig()
  const mediaDir = config.videoFolder
  const setMediaDir = (val) => updateConfig('videoFolder', val)

  const [videos, setVideos] = useState([])
  const [showPlayer, setShowPlayer] = useState(false)
  const [currentVideo, setCurrentVideo] = useState(null)
  const [showList, setShowList] = useState(false)
  const [activeTileIndex, setActiveTileIndex] = useState(null)
  const [tileOverrides, setTileOverrides] = useState({})
  const folderInputRef = useRef(null)

  useEffect(() => {
    if (!isActive) {
      setShowPlayer(false)
      setCurrentVideo(null)
      setShowList(false)
    }
  }, [isActive])

  useEffect(() => {
    if (mediaDir && isElectron()) {
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
            } else {
              if (/\.(mp4|mkv|webm|avi|mov|jpg|jpeg|png|gif|bmp|webp)$/i.test(file)) {
                let formattedPath = filePath.replace(/\\/g, '/')
                if (formattedPath.match(/^[a-zA-Z]:/)) formattedPath = `file:///${formattedPath}`
                
                fileList.push({
                  name: file.replace(/\.[^.]+$/, ''),
                  file: file,
                  path: formattedPath,
                  isVideo: /\.(mp4|mkv|webm|avi|mov)$/i.test(file),
                  isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file),
                  mtime: fs.statSync(filePath).mtimeMs,
                  size: fs.statSync(filePath).size,
                  source: 'local',
                })
              }
            }
          }
          return fileList
        }
        
        const mediaFiles = getFilesRecursively(mediaDir)
        setVideos(mediaFiles)
        setTileOverrides({})
      } catch (e) {
        console.log('Media scan failed:', e.message)
      }
    }
  }, [mediaDir])

  const openVideo = (video, tileIndex = null) => {
    setCurrentVideo(video)
    setActiveTileIndex(tileIndex)
    setShowPlayer(true)
  }

  const navigateMedia = (direction, e) => {
    if (e) e.stopPropagation()
    if (!currentVideo || videos.length === 0) return
    const currentIndex = videos.findIndex(v => v.path === currentVideo.path)
    if (currentIndex === -1) return
    
    let nextIndex = currentIndex + direction
    if (nextIndex >= videos.length) nextIndex = 0
    if (nextIndex < 0) nextIndex = videos.length - 1
    
    setCurrentVideo(videos[nextIndex])
  }

  const closePlayer = () => {
    if (activeTileIndex !== null && currentVideo) {
      setTileOverrides(prev => ({ ...prev, [activeTileIndex]: currentVideo }))
    }
    setShowPlayer(false)
    setCurrentVideo(null)
    setActiveTileIndex(null)
  }

  const openFolders = async () => {
    if (isElectron()) {
      try {
        const ipcRenderer = getIpcRenderer()
        const result = await ipcRenderer.invoke('dialog:openDirectory')
        if (result && !result.canceled && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0]
          setMediaDir(selectedPath)
        }
      } catch(e) {
        console.log('Cannot open folder dialog', e)
      }
    } else {
      folderInputRef.current?.click()
    }
  }

  const handleFolderInput = (e) => {
    const files = Array.from(e.target.files)
    const mediaFiles = files
      .filter(f => /\.(mp4|mkv|webm|avi|mov|jpg|jpeg|png|gif|bmp|webp)$/i.test(f.name))
      .map(f => {
        const url = URL.createObjectURL(f)
        return {
          name: f.name.replace(/\.[^.]+$/, ''),
          file: f.name,
          path: url,
          isVideo: /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name),
          isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f.name),
          mtime: f.lastModified,
          size: f.size,
          source: 'local',
        }
      })
    setVideos(mediaFiles)
    setTileOverrides({})
    setMediaDir(e.target.files[0]?.webkitRelativePath?.split('/')[0] || 'Media')
  }

  return (
    <>
      <div className="video-grid">
        <div className="video-left-1">
          <Tile
            label="My Media"
            icon={<img src="./assets/icons/video.png" alt="My Media" />}
            onClick={() => setShowList(true)}
          />
        </div>
        <div className="video-left-2">
          <Tile label="Folders" icon={<img src="./assets/icons/Folder.png" alt="Folders" />} onClick={openFolders} />
        </div>

        <div className="video-center">
          {videos.length > 0 ? (
            (() => {
              const item = tileOverrides[0] || videos[0]
              return (
                <Tile className="video-thumb-tile" onClick={() => openVideo(item, 0)}>
                  {item.isVideo ? (
                    <video src={item.path} className="video-thumb" muted preload="metadata" decoding="async" />
                  ) : (
                    <img src={item.path} className="video-thumb" decoding="async" loading="lazy" />
                  )}
                  <div className="video-thumb-name">{item.name}</div>
                </Tile>
              )
            })()
          ) : (
            <Tile label="No Media" />
          )}
        </div>

        <div className="video-right-1">
          {videos.length > 1 ? (
            (() => {
              const item = tileOverrides[1] || videos[1]
              return (
                <Tile className="video-thumb-tile" onClick={() => openVideo(item, 1)}>
                  {item.isVideo ? (
                    <video src={item.path} className="video-thumb" muted preload="metadata" decoding="async" />
                  ) : (
                    <img src={item.path} className="video-thumb" decoding="async" loading="lazy" />
                  )}
                  <div className="video-thumb-name">{item.name}</div>
                </Tile>
              )
            })()
          ) : (
            <Tile />
          )}
        </div>
        <div className="video-right-2">
          {videos.length > 2 ? (
            (() => {
              const item = tileOverrides[2] || videos[2]
              return (
                <Tile className="video-thumb-tile" onClick={() => openVideo(item, 2)}>
                  {item.isVideo ? (
                    <video src={item.path} className="video-thumb" muted preload="metadata" decoding="async" />
                  ) : (
                    <img src={item.path} className="video-thumb" decoding="async" loading="lazy" />
                  )}
                  <div className="video-thumb-name">{item.name}</div>
                </Tile>
              )
            })()
          ) : (
            <Tile />
          )}
        </div>
      </div>

      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={handleFolderInput} />

      {/* MY MEDIA COLLECTION */}
      {showList && (
        <CollectionPage
          title="My Media"
          items={videos.map(v => ({ ...v, id: v.path, icon: v.path }))}
          onClose={() => setShowList(false)}
          onItemAction={(v) => { openVideo(v) }}
          filters={[{ label: 'all media' }]}
          emptyMessage="No media found. Select a folder containing videos or photos."
          isActive={isActive}
          renderItem={(v) => (
            v.isVideo ? (
              <video src={v.path} muted preload="metadata" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={v.path} alt={v.name} decoding="async" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )
          )}
        />
      )}

      {/* Video Player Modal */}
      {showPlayer && currentVideo && createPortal(
        <div className="modal-overlay video-player-overlay" onClick={closePlayer}>
          <div className="video-player-container" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button className="video-player-close" onClick={closePlayer}>✕</button>
            <button className="media-nav-btn media-nav-prev" onClick={(e) => navigateMedia(-1, e)}>‹</button>
            
            {currentVideo.isVideo ? (
              <video
                src={currentVideo.path}
                controls
                autoPlay
                className="video-player"
              />
            ) : (
              <img src={currentVideo.path} className="video-player" style={{ objectFit: 'contain' }} />
            )}
            
            <button className="media-nav-btn media-nav-next" onClick={(e) => navigateMedia(1, e)}>›</button>
            <div className="video-player-title">{currentVideo.name}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
