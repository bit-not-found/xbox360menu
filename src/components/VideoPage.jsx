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
  const folderInputRef = useRef(null)

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
                  isVideo: /\.(mp4|mkv|webm|avi|mov)$/i.test(file)
                })
              }
            }
          }
          return fileList
        }
        
        const mediaFiles = getFilesRecursively(mediaDir)
        setVideos(mediaFiles)
      } catch (e) {
        console.log('Media scan failed:', e.message)
      }
    }
  }, [mediaDir])

  const openVideo = (video) => {
    setCurrentVideo(video)
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
    setShowPlayer(false)
    setCurrentVideo(null)
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
          isVideo: /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name)
        }
      })
    setVideos(mediaFiles)
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
            <Tile className="video-thumb-tile" onClick={() => openVideo(videos[0])}>
              {videos[0].isVideo ? (
                <video src={videos[0].path} className="video-thumb" muted preload="metadata" />
              ) : (
                <img src={videos[0].path} className="video-thumb" />
              )}
              <div className="video-thumb-name">{videos[0].name}</div>
            </Tile>
          ) : (
            <Tile label="No Media" />
          )}
        </div>

        <div className="video-right-1">
          {videos.length > 1 ? (
            <Tile className="video-thumb-tile" onClick={() => openVideo(videos[1])}>
              {videos[1].isVideo ? (
                <video src={videos[1].path} className="video-thumb" muted preload="metadata" />
              ) : (
                <img src={videos[1].path} className="video-thumb" />
              )}
              <div className="video-thumb-name">{videos[1].name}</div>
            </Tile>
          ) : (
            <Tile />
          )}
        </div>
        <div className="video-right-2">
          {videos.length > 2 ? (
            <Tile className="video-thumb-tile" onClick={() => openVideo(videos[2])}>
              {videos[2].isVideo ? (
                <video src={videos[2].path} className="video-thumb" muted preload="metadata" />
              ) : (
                <img src={videos[2].path} className="video-thumb" />
              )}
              <div className="video-thumb-name">{videos[2].name}</div>
            </Tile>
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
          onItemAction={(v) => { openVideo(v); setShowList(false); }}
          filters={[{ label: 'all media' }]}
          emptyMessage="No media found. Select a folder containing videos or photos."
          isActive={isActive}
          renderItem={(v) => (
            v.isVideo ? (
              <video src={v.path} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={v.path} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
