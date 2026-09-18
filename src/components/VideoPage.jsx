import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import CollectionPage from './CollectionPage'
import { useConfig } from '../context/ConfigContext'
import { isElectron, getIpcRenderer, getNodeFs, getNodePath } from '../utils/electron'

const MEDIA_EXT = /\.(mp4|mkv|webm|avi|mov|jpg|jpeg|png|gif|bmp|webp)$/i
const VIDEO_EXT = /\.(mp4|mkv|webm|avi|mov)$/i

function buildMediaObject(name, file, path, extra = {}) {
  return {
    name: name.replace(/\.[^.]+$/, ''),
    file,
    path,
    isVideo: VIDEO_EXT.test(file),
    isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file),
    ...extra,
  }
}

export default function VideoPage({ isActive }) {
  const { config, updateConfig } = useConfig()
  const videoFolders = config.videoFolders || []

  const [videos, setVideos] = useState([])
  const [showPlayer, setShowPlayer] = useState(false)
  const [currentVideo, setCurrentVideo] = useState(null)
  const [showList, setShowList] = useState(false)
  const [showVideoList, setShowVideoList] = useState(false)
  const [activeTileIndex, setActiveTileIndex] = useState(null)
  const [tileOverrides, setTileOverrides] = useState({})
  const folderInputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isActive) {
      setShowPlayer(false)
      setCurrentVideo(null)
      setShowList(false)
      setShowVideoList(false)
    }
  }, [isActive])

  const scanFolder = useCallback((folderPath) => {
    if (!isElectron()) return []
    try {
      const fs = getNodeFs()
      const path = getNodePath()
      if (!fs || !path) return []

      const getFilesRecursively = (dir, fileList = []) => {
        if (!fs.existsSync(dir)) return fileList
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const filePath = path.join(dir, file)
          if (fs.statSync(filePath).isDirectory()) {
            getFilesRecursively(filePath, fileList)
          } else if (MEDIA_EXT.test(file)) {
            let formattedPath = filePath.replace(/\\/g, '/')
            if (formattedPath.match(/^[a-zA-Z]:/)) formattedPath = `file:///${formattedPath}`
            fileList.push(buildMediaObject(file, file, formattedPath, {
              mtime: fs.statSync(filePath).mtimeMs,
              size: fs.statSync(filePath).size,
              source: 'local',
            }))
          }
        }
        return fileList
      }

      return getFilesRecursively(folderPath)
    } catch (e) {
      console.log('Media scan failed for', folderPath, e.message)
      return []
    }
  }, [])

  useEffect(() => {
    if (videoFolders.length === 0 || !isElectron()) return
    const allFiles = []
    const seen = new Set()
    for (const folder of videoFolders) {
      const files = scanFolder(folder)
      for (const f of files) {
        if (!seen.has(f.path)) {
          seen.add(f.path)
          allFiles.push(f)
        }
      }
    }
    if (allFiles.length > 0) {
      setVideos(prev => {
        const prevPaths = new Set(prev.map(v => v.path))
        const newItems = allFiles.filter(f => !prevPaths.has(f.path))
        return newItems.length > 0 ? [...prev, ...newItems] : prev
      })
    }
  }, [videoFolders, scanFolder])

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
          const normalized = selectedPath.replace(/\\/g, '/')
          if (videoFolders.some(f => f.replace(/\\/g, '/') === normalized)) {
            return
          }
          updateConfig('videoFolders', [...videoFolders, selectedPath])
          const newFiles = scanFolder(selectedPath)
          setVideos(prev => {
            const seen = new Set(prev.map(v => v.path))
            const toAdd = newFiles.filter(f => !seen.has(f.path))
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev
          })
          setTileOverrides({})
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
    const newFiles = files
      .filter(f => MEDIA_EXT.test(f.name))
      .map(f => {
        const url = URL.createObjectURL(f)
        return buildMediaObject(f.name, f.name, url, {
          mtime: f.lastModified,
          size: f.size,
          source: 'local',
        })
      })

    setVideos(prev => {
      const seen = new Set(prev.map(v => v.path))
      const toAdd = newFiles.filter(f => !seen.has(f.path))
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev
    })
    setTileOverrides({})

    const folderName = e.target.files[0]?.webkitRelativePath?.split('/')[0] || 'Media'
    const existing = videoFolders || []
    if (!existing.includes(folderName)) {
      updateConfig('videoFolders', [...existing, folderName])
    }
    e.target.value = ''
  }

  const openSingleFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleSingleFileInput = (e) => {
    const files = Array.from(e.target.files)
    const newFiles = files
      .filter(f => MEDIA_EXT.test(f.name))
      .map(f => {
        const url = URL.createObjectURL(f)
        return buildMediaObject(f.name, f.name, url, {
          mtime: f.lastModified,
          size: f.size,
          source: 'local',
        })
      })

    setVideos(prev => {
      const seen = new Set(prev.map(v => v.path))
      const toAdd = newFiles.filter(f => !seen.has(f.path))
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev
    })
    setTileOverrides({})
    e.target.value = ''
  }

  const deleteMediaItem = (item) => {
    setVideos(prev => prev.filter(v => v.path !== item.path))
  }

  return (
    <>
      <div className="video-grid">
        <div className="video-left-1">
          <Tile
            label="My Photos"
            icon={<img src="./assets/icons/video.png" alt="My Photos" />}
            onClick={() => setShowList(true)}
          />
        </div>
        <div className="video-left-2">
          <Tile label="My Videos" icon={<img src="./assets/icons/Folder.png" alt="My Videos" />} onClick={() => setShowVideoList(true)} />
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
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={handleSingleFileInput} />

      {/* MY MEDIA COLLECTION */}
      {showList && (
        <CollectionPage
          title="My Photos"
          mode="media"
          items={videos.map(v => ({ ...v, id: v.path, icon: v.path }))}
          onClose={() => setShowList(false)}
          onItemAction={(v) => { openVideo(v) }}
          onAddItem={openFolders}
          onAddItem2={openSingleFilePicker}
          onDeleteItem={deleteMediaItem}
          filters={[{ label: 'all media' }]}
          emptyMessage="No media found. Click + Add Folder or + Add Photos to begin."
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

      {/* MY VIDEOS COLLECTION */}
      {showVideoList && (
        <CollectionPage
          title="My Videos"
          mode="media"
          items={videos.filter(v => v.isVideo).map(v => ({ ...v, id: v.path, icon: v.path }))}
          onClose={() => setShowVideoList(false)}
          onItemAction={(v) => { openVideo(v) }}
          onAddItem={openFolders}
          onAddItem2={openSingleFilePicker}
          onDeleteItem={deleteMediaItem}
          emptyMessage="No videos found. Click + Add Folder or + Add Photos to begin."
          isActive={isActive}
          renderItem={(v) => (
            <video src={v.path} muted preload="metadata" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
