import { createContext, useContext, useState, useEffect } from 'react'
import { isElectron, getIpcRenderer } from '../utils/electron'

const ConfigContext = createContext()

export const useConfig = () => useContext(ConfigContext)

const defaultApps = [
  { name: 'YouTube', url: 'https://www.youtube.com', img: './assets/imgs/youtube.png' },
  { name: 'Netflix', url: 'https://www.netflix.com', img: './assets/imgs/netflix.png' },
  { name: 'Twitch', url: 'https://www.twitch.tv', img: './assets/imgs/twitch.png' },
  { name: 'Spotify', url: 'https://open.spotify.com', img: './assets/imgs/spotify.png' },
  { name: 'X', url: 'https://x.com', img: './assets/imgs/x.png' },
]

function loadFromLocalStorage() {
  const savedVideoFolders = JSON.parse(localStorage.getItem('videoFolders') || '[]')
  const legacyVideoFolder = localStorage.getItem('videoFolder') || ''
  const videoFolders = savedVideoFolders.length > 0
    ? savedVideoFolders
    : legacyVideoFolder ? [legacyVideoFolder] : []

  return {
    myGames: JSON.parse(localStorage.getItem('myGames') || '[]'),
    myApps: JSON.parse(localStorage.getItem('myApps') || 'null') || defaultApps,
    pinnedTracks: JSON.parse(localStorage.getItem('pinnedTracks') || '[]'),
    customMusicCovers: JSON.parse(localStorage.getItem('customMusicCovers') || '{}'),
    musicFolder: localStorage.getItem('musicFolder') || '',
    videoFolder: localStorage.getItem('videoFolder') || '',
    videoFolders,
    homeTiles: JSON.parse(localStorage.getItem('homeTiles') || '{}'),
    romFolder: localStorage.getItem('romFolder') || '',
    myRoms: JSON.parse(localStorage.getItem('myRoms') || '[]')
  }
}

function saveToLocalStorage(data) {
  localStorage.setItem('myGames', JSON.stringify(data.myGames))
  localStorage.setItem('myApps', JSON.stringify(data.myApps))
  localStorage.setItem('pinnedTracks', JSON.stringify(data.pinnedTracks))
  localStorage.setItem('customMusicCovers', JSON.stringify(data.customMusicCovers))
  localStorage.setItem('musicFolder', data.musicFolder)
  localStorage.setItem('videoFolder', data.videoFolder)
  localStorage.setItem('videoFolders', JSON.stringify(data.videoFolders || []))
  localStorage.setItem('homeTiles', JSON.stringify(data.homeTiles))
  localStorage.setItem('romFolder', data.romFolder)
  localStorage.setItem('myRoms', JSON.stringify(data.myRoms))
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const loadAll = async () => {
      if (isElectron()) {
        try {
          const ipcRenderer = getIpcRenderer()
          let data = await ipcRenderer.invoke('config:load')
          
          if (!data) {
            data = loadFromLocalStorage()
            await ipcRenderer.invoke('config:save', data)
          }
          
          setConfig(data)
        } catch (e) {
          console.error('Failed to load config from Electron', e)
          setConfig(loadFromLocalStorage())
        }
      } else {
        setConfig(loadFromLocalStorage())
      }
    }
    loadAll()
  }, [])

  const updateConfig = async (key, value) => {
    const newConfig = { ...config, [key]: value }
    setConfig(newConfig)
    saveToLocalStorage(newConfig)
    if (isElectron()) {
      try {
        const ipcRenderer = getIpcRenderer()
        await ipcRenderer.invoke('config:save', newConfig)
      } catch (e) {
        console.error('Failed to save config to Electron', e)
      }
    }
  }

  if (!config) return null

  return (
    <ConfigContext.Provider value={{ config, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}
