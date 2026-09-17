import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Tile from './Tile'
import { useConfig } from '../context/ConfigContext'

const defaultApps = [
  { name: 'YouTube', url: 'https://www.youtube.com', img: './assets/imgs/youtube.png' },
  { name: 'Netflix', url: 'https://www.netflix.com', img: './assets/imgs/netflix.png' },
  { name: 'Twitch', url: 'https://www.twitch.tv', img: './assets/imgs/twitch.png' },
  { name: 'Spotify', url: 'https://open.spotify.com', img: './assets/imgs/spotify.png' },
  { name: 'X', url: 'https://x.com', img: './assets/imgs/x.png' },
]

export default function AppsPage({ isActive }) {
  const { config, updateConfig } = useConfig()
  const apps = config.myApps

  const setApps = (newVal) => {
    if (typeof newVal === 'function') {
      updateConfig('myApps', newVal(apps))
    } else {
      updateConfig('myApps', newVal)
    }
  }

  const [showModal, setShowModal] = useState(false)
  const [editingAppName, setEditingAppName] = useState(null)
  const [newAppName, setNewAppName] = useState('')
  const [newAppUrl, setNewAppUrl] = useState('')
  const [previewIcon, setPreviewIcon] = useState(null)

  useEffect(() => {
    if (!isActive) {
      setShowModal(false)
      setEditingAppName(null)
    }
  }, [isActive])

  const handleOpenApp = (url) => {
    if (url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://')) {
      window.open(url, '_blank')
    } else {
      try {
        const { exec } = window.require('child_process')
        const path = window.require('path')
        const cwd = path.dirname(url)
        exec(`start "" "${url}"`, { cwd }, (err) => {
          if (err) console.error('Failed to launch:', err)
        })
      } catch (e) {
        console.error('Failed to launch:', e)
      }
    }
  }

  const handleAddApp = () => {
    if (!newAppName || !newAppUrl) return

    const appData = { 
      name: newAppName, 
      url: newAppUrl, 
      img: previewIcon || './assets/imgs/260x195-PLACEHOLDER.png' 
    }

    if (editingAppName) {
      setApps(apps.map(a => a.name === editingAppName ? appData : a))
    } else {
      setApps([...apps, appData])
    }

    closeModal()
  }

  const handleDeleteApp = () => {
    if (!editingAppName) return
    setApps(apps.filter(a => a.name !== editingAppName))
    closeModal()
  }

  const openAddModal = () => {
    setEditingAppName(null)
    setNewAppName('')
    setNewAppUrl('')
    setPreviewIcon(null)
    setShowModal(true)
  }

  const openEditModal = (app, e) => {
    e.preventDefault()
    setEditingAppName(app.name)
    setNewAppName(app.name)
    setNewAppUrl(app.url)
    setPreviewIcon(app.img)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAppName(null)
  }

  return (
    <>
      <div className="apps-layout">
        <div className="apps-add-tile">
          <Tile label="Add Apps" icon={<img src="./assets/icons/add_apps.png" alt="Add Apps" />} onClick={openAddModal} />
        </div>

        <div className="apps-list">
          {apps.map((app) => (
            <div key={app.name} className="apps-tile-wrapper">
              <Tile 
                className="app-tile" 
                onClick={() => handleOpenApp(app.url)}
                onContextMenu={(e) => openEditModal(app, e)}
              >
                <img src={app.img} alt={app.name} className="app-cover-img" />
              </Tile>
            </div>
          ))}
        </div>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAppName ? 'Edit App' : 'Add New App'}</h2>

            <label>App Name</label>
            <input
              type="text"
              placeholder="Ex: Discord"
              value={newAppName}
              onChange={(e) => setNewAppName(e.target.value)}
            />

            <label>URL or Executable Path</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type="text"
                placeholder="Ex: https://discord.com or C:\Games\game.exe"
                value={newAppUrl}
                onChange={(e) => setNewAppUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <button 
                className="modal-btn" 
                onClick={async () => {
                  try {
                    const { ipcRenderer } = window.require('electron')
                    const result = await ipcRenderer.invoke('dialog:openFile', { filters: [{ name: 'Executables', extensions: ['exe', 'bat', 'lnk'] }] })
                    if (result && !result.canceled && result.filePaths.length > 0) {
                      setNewAppUrl(result.filePaths[0])
                    }
                  } catch (err) {
                    console.error(err)
                  }
                }} 
                style={{ padding: '0 15px', fontSize: 20 }}
              >
                +
              </button>
            </div>

            <label>Icon (Path or URL)</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input 
                type="text" 
                placeholder="Path to Icon" 
                value={previewIcon || ''} 
                onChange={(e) => setPreviewIcon(e.target.value)}
                style={{ flex: 1 }} 
              />
              <button className="modal-btn" onClick={async () => {
                const { ipcRenderer } = window.require('electron')
                const res = await ipcRenderer.invoke('dialog:openFile', { filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'webp'] }] })
                if (res && !res.canceled && res.filePaths.length > 0) {
                  let fp = res.filePaths[0].replace(/\\/g, '/')
                  if (fp.match(/^[a-zA-Z]:/)) fp = `file:///${fp}`
                  setPreviewIcon(fp)
                }
              }} style={{ padding: '0 15px', fontSize: 20 }}>+</button>
            </div>

            {previewIcon && (
              <div className="modal-icon-preview">
                <img src={previewIcon} alt="Preview" />
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={closeModal}>Cancel</button>
              {editingAppName && (
                <button className="modal-btn" onClick={handleDeleteApp} style={{ backgroundColor: '#ff4444' }}>Delete</button>
              )}
              <button className="modal-btn confirm" onClick={handleAddApp}>{editingAppName ? 'Save Changes' : 'Add App'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
