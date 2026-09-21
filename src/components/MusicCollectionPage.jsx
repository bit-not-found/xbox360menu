import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '../context/ConfigContext'
import { useMusic } from '../context/MusicContext'

const hoverAudio = new Audio('./assets/audio/hover.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')
const selectAudio = new Audio('./assets/audio/Select.mp3')

const playHover = () => { hoverAudio.currentTime = 0; hoverAudio.play().catch(() => {}) }
const playBack = () => { backAudio.currentTime = 0; backAudio.play().catch(() => {}) }
const playSelect = () => { selectAudio.currentTime = 0; selectAudio.play().catch(() => {}) }

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

const SORT_OPTIONS = {
  artists: [
    { id: 'name', label: 'Name A-Z' },
    { id: 'name-desc', label: 'Name Z-A' },
    { id: 'playcount', label: 'Most Played' },
  ],
  albums: [
    { id: 'name', label: 'Name A-Z' },
    { id: 'name-desc', label: 'Name Z-A' },
    { id: 'artist', label: 'Artist' },
    { id: 'year', label: 'Release Year' },
  ],
  songs: [
    { id: 'name', label: 'Name A-Z' },
    { id: 'name-desc', label: 'Name Z-A' },
    { id: 'artist', label: 'Artist' },
    { id: 'album', label: 'Album' },
    { id: 'duration', label: 'Duration' },
    { id: 'playcount', label: 'Most Played' },
    { id: 'dateAdded', label: 'Date Added' },
  ],
  genres: [
    { id: 'name', label: 'Name A-Z' },
    { id: 'count', label: 'Track Count' },
  ],
  playlists: [
    { id: 'name', label: 'Name A-Z' },
    { id: 'name-desc', label: 'Name Z-A' },
    { id: 'trackCount', label: 'Track Count' },
  ],
  recentlyAdded: [
    { id: 'dateAdded', label: 'Newest First' },
    { id: 'dateAdded-asc', label: 'Oldest First' },
    { id: 'name', label: 'Name A-Z' },
  ],
  favorites: [
    { id: 'name', label: 'Name A-Z' },
    { id: 'artist', label: 'Artist' },
    { id: 'playcount', label: 'Most Played' },
  ],
  smartMixes: [],
}

function formatDuration(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getFileFormat(path) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return ext.toUpperCase()
}

export default function MusicCollectionPage({
  view: initialView = 'songs',
  playlist = [],
  onClose,
  isActive = true,
  config,
  updateConfig,
  customMusicCovers = {},
  onPlayTrack,
  onPlayAlbum,
  onAddToQueue,
  onPlayNext,
}) {
  const [isClosing, setIsClosing] = useState(false)
  const [view, setView] = useState(initialView)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [genreFilter, setGenreFilter] = useState('')
  const [formatFilter, setFormatFilter] = useState('')
  const [selectedLetter, setSelectedLetter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showNewPlaylist, setShowNewPlaylist] = useState(false)
  const [trackInfo, setTrackInfo] = useState(null)

  const scrollRef = useRef(null)

  const playlists = config.musicPlaylists || []
  const playCounts = config.musicPlayCounts || {}
  const recentlyPlayed = config.musicRecentlyPlayed || []
  const favorites = new Set(config.musicFavorites || [])

  // Reset sort when view changes
  useEffect(() => {
    const defaultSorts = {
      songs: 'name', artists: 'name', albums: 'name', genres: 'name',
      playlists: 'name', smartMixes: '', recentlyAdded: 'dateAdded', favorites: 'name',
    }
    setSortBy(defaultSorts[view] || 'name')
  }, [view])

  const setPlaylists = useCallback((val) => {
    const next = typeof val === 'function' ? val(config.musicPlaylists || []) : val
    updateConfig('musicPlaylists', next)
  }, [config.musicPlaylists, updateConfig])

  const setPlayCounts = useCallback((val) => {
    const next = typeof val === 'function' ? val(config.musicPlayCounts || {}) : val
    updateConfig('musicPlayCounts', next)
  }, [config.musicPlayCounts, updateConfig])

  const setRecentlyPlayed = useCallback((val) => {
    const next = typeof val === 'function' ? val(config.musicRecentlyPlayed || []) : val
    updateConfig('musicRecentlyPlayed', next)
  }, [config.musicRecentlyPlayed, updateConfig])

  const setFavorites = useCallback((val) => {
    const next = typeof val === 'function' ? val(config.musicFavorites || []) : val
    updateConfig('musicFavorites', next)
  }, [config.musicFavorites, updateConfig])

  const toggleFavorite = useCallback((trackPath) => {
    setFavorites(prev => prev.includes(trackPath) ? prev.filter(p => p !== trackPath) : [...prev, trackPath])
  }, [setFavorites])

  const recordPlay = useCallback((trackPath) => {
    setPlayCounts(prev => ({ ...prev, [trackPath]: (prev[trackPath] || 0) + 1 }))
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(p => p !== trackPath)
      return [trackPath, ...filtered].slice(0, 200)
    })
  }, [setPlayCounts, setRecentlyPlayed])

  useEffect(() => {
    if (!isActive) {
      setIsClosing(true)
      const t = setTimeout(() => onClose(), 300)
      return () => clearTimeout(t)
    }
  }, [isActive])

  useEffect(() => {
    const handleGuideOpened = () => {
      if (!isClosing) handleClose()
    }
    window.addEventListener('guide-opened', handleGuideOpened)
    return () => window.removeEventListener('guide-opened', handleGuideOpened)
  }, [isClosing])

  const handleClose = () => {
    playBack()
    setIsClosing(true)
    setTimeout(() => onClose(), 300)
  }

  const getCoverUrl = (track) => {
    if (!track) return ''
    return customMusicCovers[track.path] || track.cover || ''
  }

  const handlePlayTrack = (track) => {
    playSelect()
    if (onPlayTrack) {
      const idx = playlist.findIndex(t => t.path === track.path)
      if (idx !== -1) {
        onPlayTrack(idx)
        recordPlay(track.path)
      }
    }
  }

  const handleContextMenu = (e, track) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, track })
  }

  useEffect(() => {
    if (contextMenu) {
      const close = () => setContextMenu(null)
      window.addEventListener('click', close)
      window.addEventListener('contextmenu', close)
      return () => {
        window.removeEventListener('click', close)
        window.removeEventListener('contextmenu', close)
      }
    }
  }, [contextMenu])

  const allGenres = useMemo(() => {
    const set = new Set()
    playlist.forEach(t => { if (t.genre) set.add(t.genre) })
    return [...set].sort()
  }, [playlist])

  const allFormats = useMemo(() => {
    const set = new Set()
    playlist.forEach(t => { if (t.path) set.add(getFileFormat(t.path)) })
    return [...set].sort()
  }, [playlist])

  const filteredPlaylist = useMemo(() => {
    let result = [...playlist]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q) ||
        (t.album || '').toLowerCase().includes(q)
      )
    }

    if (genreFilter) {
      result = result.filter(t => t.genre === genreFilter)
    }

    if (formatFilter) {
      result = result.filter(t => getFileFormat(t.path) === formatFilter)
    }

    if (selectedLetter) {
      result = result.filter(t => {
        const first = (t.name || t.artist || '#')[0].toUpperCase()
        if (selectedLetter === '#') return !first.match(/[A-Z]/)
        return first === selectedLetter
      })
    }

    switch (sortBy) {
      case 'name':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'name-desc':
        result.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
        break
      case 'artist':
        result.sort((a, b) => (a.artist || 'zzz').localeCompare(b.artist || 'zzz'))
        break
      case 'album':
        result.sort((a, b) => (a.album || 'zzz').localeCompare(b.album || 'zzz'))
        break
      case 'duration':
        result.sort((a, b) => (a.duration || 0) - (b.duration || 0))
        break
      case 'playcount':
        result.sort((a, b) => (playCounts[b.path] || 0) - (playCounts[a.path] || 0))
        break
      case 'dateAdded':
        result.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        break
      case 'dateAdded-asc':
        result.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))
        break
      case 'year':
        result.sort((a, b) => (a.year || 0) - (b.year || 0))
        break
      case 'count':
        break
      case 'trackCount':
        break
    }

    return result
  }, [playlist, search, sortBy, genreFilter, formatFilter, selectedLetter, playCounts])

  const artists = useMemo(() => {
    const map = new Map()
    playlist.forEach(t => {
      const name = t.artist || 'Unknown Artist'
      if (!map.has(name)) {
        map.set(name, { name, tracks: [], cover: '', playCount: 0 })
      }
      const artist = map.get(name)
      artist.tracks.push(t)
      if (!artist.cover && t.cover) artist.cover = t.cover
      artist.playCount += (playCounts[t.path] || 0)
    })
    let arr = [...map.values()]
    if (sortBy === 'playcount') arr.sort((a, b) => b.playCount - a.playCount)
    else arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr
  }, [playlist, sortBy, playCounts])

  const filteredArtists = useMemo(() => {
    let result = artists
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a => a.name.toLowerCase().includes(q))
    }
    if (selectedLetter) {
      result = result.filter(a => {
        const first = a.name[0].toUpperCase()
        if (selectedLetter === '#') return !first.match(/[A-Z]/)
        return first === selectedLetter
      })
    }
    return result
  }, [artists, search, selectedLetter])

  const albums = useMemo(() => {
    const map = new Map()
    playlist.forEach(t => {
      const key = `${t.artist || 'Unknown'}|||${t.album || 'Unknown Album'}`
      if (!map.has(key)) {
        map.set(key, { artist: t.artist || 'Unknown Artist', name: t.album || 'Unknown Album', tracks: [], cover: '', year: t.year || 0, totalDuration: 0 })
      }
      const album = map.get(key)
      album.tracks.push(t)
      if (!album.cover && t.cover) album.cover = t.cover
      if (!album.year && t.year) album.year = t.year
      album.totalDuration += (t.duration || 0)
    })
    let arr = [...map.values()]
    if (sortBy === 'artist') arr.sort((a, b) => a.artist.localeCompare(b.artist))
    else if (sortBy === 'year') arr.sort((a, b) => (b.year || 0) - (a.year || 0))
    else if (sortBy === 'name-desc') arr.sort((a, b) => b.name.localeCompare(a.name))
    else arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr
  }, [playlist, sortBy])

  const filteredAlbums = useMemo(() => {
    let result = albums
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
    }
    return result
  }, [albums, search])

  const genres = useMemo(() => {
    const map = new Map()
    playlist.forEach(t => {
      const name = t.genre || 'Unknown'
      if (!map.has(name)) map.set(name, { name, tracks: [] })
      map.get(name).tracks.push(t)
    })
    let arr = [...map.values()]
    if (sortBy === 'count') arr.sort((a, b) => b.tracks.length - a.tracks.length)
    else arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr
  }, [playlist, sortBy])

  const smartMixes = useMemo(() => {
    const mostPlayed = [...playlist]
      .sort((a, b) => (playCounts[b.path] || 0) - (playCounts[a.path] || 0))
      .slice(0, 20)

    const forgotten = [...playlist]
      .filter(t => {
        const count = recentlyPlayed.indexOf(t.path)
        return count === -1 || count > 50
      })
      .sort(() => Math.random() - 0.5)
      .slice(0, 20)

    const recent = playlist
      .filter(t => recentlyPlayed.includes(t.path))
      .sort((a, b) => recentlyPlayed.indexOf(a.path) - recentlyPlayed.indexOf(b.path))
      .slice(0, 20)

    return { mostPlayed, forgotten, recent }
  }, [playlist, playCounts, recentlyPlayed])

  const favoriteTracks = useMemo(() => {
    return playlist.filter(t => favorites.has(t.path))
  }, [playlist, favorites])

  const recentlyAddedTracks = useMemo(() => {
    return [...playlist]
      .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      .slice(0, 50)
  }, [playlist])

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return
    setPlaylists(prev => [...prev, { id: Date.now().toString(), name: newPlaylistName.trim(), tracks: [] }])
    setNewPlaylistName('')
    setShowNewPlaylist(false)
  }

  const deletePlaylist = (id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id))
    if (selectedPlaylist?.id === id) setSelectedPlaylist(null)
  }

  const addToPlaylist = (playlistId, trackPath) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.tracks.includes(trackPath)) return p
        return { ...p, tracks: [...p.tracks, trackPath] }
      }
      return p
    }))
  }

  const removeFromPlaylist = (playlistId, trackPath) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t !== trackPath) }
      }
      return p
    }))
  }

  const getTrackByPath = (path) => playlist.find(t => t.path === path)

  const renderContextMenu = () => {
    if (!contextMenu) return null
    const { x, y, track } = contextMenu
    return createPortal(
      <div className="music-context-menu" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
        <div className="music-context-item" onClick={() => { handlePlayTrack(track); setContextMenu(null) }}>
          Play
        </div>
        <div className="music-context-item" onClick={() => { if (onAddToQueue) onAddToQueue(track); setContextMenu(null) }}>
          Add to Queue
        </div>
        <div className="music-context-item" onClick={() => { if (onPlayNext) onPlayNext(track); setContextMenu(null) }}>
          Play Next
        </div>
        <div className="music-context-separator" />
        {playlists.length > 0 && (
          <div className="music-context-submenu">
            <div className="music-context-item">Add to Playlist ▸</div>
            <div className="music-context-submenu-items">
              {playlists.map(p => (
                <div key={p.id} className="music-context-item" onClick={() => { addToPlaylist(p.id, track.path); setContextMenu(null) }}>
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="music-context-item" onClick={() => { setShowNewPlaylist(true); setContextMenu(null) }}>
          + New Playlist
        </div>
        <div className="music-context-separator" />
        <div className="music-context-item" onClick={() => { setContextMenu(null) }}>
          Go to Artist
        </div>
        <div className="music-context-item" onClick={() => { setContextMenu(null) }}>
          Go to Album
        </div>
        <div className="music-context-separator" />
        <div className="music-context-item" onClick={() => { toggleFavorite(track.path); setContextMenu(null) }}>
          {favorites.has(track.path) ? '♥ Remove from Favorites' : '♡ Add to Favorites'}
        </div>
        <div className="music-context-item" onClick={() => { setTrackInfo(track); setContextMenu(null) }}>
          View File Info
        </div>
      </div>,
      document.body
    )
  }

  const renderTrackList = (tracks, showArtist = true, showAlbum = true) => (
    <div className="music-track-list">
      {tracks.map((track, i) => (
        <div
          key={track.path || i}
          className="music-track-row"
          onClick={() => handlePlayTrack(track)}
          onContextMenu={(e) => handleContextMenu(e, track)}
          onMouseEnter={playHover}
        >
          <span className="music-track-num">{i + 1}</span>
          <div className="music-track-cover-small">
            {getCoverUrl(track) ? (
              <img src={getCoverUrl(track)} alt="" />
            ) : (
              <img src="./assets/icons/Music.png" alt="" style={{ width: 20, height: 20, opacity: 0.5 }} />
            )}
          </div>
          <div className="music-track-info-col">
            <span className="music-track-row-name">{track.name}</span>
            {showArtist && <span className="music-track-row-artist">{track.artist || 'Unknown Artist'}</span>}
          </div>
          {showAlbum && <span className="music-track-row-album">{track.album || ''}</span>}
          <span className="music-track-row-format">{getFileFormat(track.path)}</span>
          <span className="music-track-row-duration">{formatDuration(track.duration)}</span>
          <span className="music-track-row-plays">{playCounts[track.path] || 0}</span>
          <button
            className={`music-track-fav-btn ${favorites.has(track.path) ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(track.path) }}
          >
            {favorites.has(track.path) ? '♥' : '♡'}
          </button>
        </div>
      ))}
    </div>
  )

  const renderArtistsView = () => (
    <div className="music-artists-view">
      <div className="music-alphabet-scrubber">
        {ALPHABET.map(letter => (
          <button
            key={letter}
            className={`music-letter-btn ${selectedLetter === letter ? 'active' : ''}`}
            onClick={() => { playSelect(); setSelectedLetter(selectedLetter === letter ? '' : letter) }}
            onMouseEnter={playHover}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="music-artists-grid" ref={scrollRef}>
        {filteredArtists.map(artist => (
          <div
            key={artist.name}
            className="music-artist-card"
            onClick={() => { playSelect(); setSelectedArtist(artist) }}
            onMouseEnter={playHover}
          >
            <div className="music-artist-card-img">
              {artist.cover ? (
                <img src={artist.cover} alt={artist.name} />
              ) : (
                <div className="music-artist-card-placeholder">
                  <img src="./assets/icons/Music.png" alt="" style={{ width: 40, height: 40, opacity: 0.5 }} />
                </div>
              )}
            </div>
            <div className="music-artist-card-info">
              <span className="music-artist-card-name">{artist.name}</span>
              <span className="music-artist-card-count">{artist.tracks.length} tracks</span>
            </div>
          </div>
        ))}
        {filteredArtists.length === 0 && (
          <div className="music-empty-state">No artists found</div>
        )}
      </div>
    </div>
  )

  const renderAlbumsView = () => (
    <div className="music-albums-grid" ref={scrollRef}>
      {filteredAlbums.map((album, i) => (
        <div
          key={`${album.artist}|||${album.name}|||${i}`}
          className="music-album-card"
          onClick={() => { playSelect(); setSelectedAlbum(album) }}
          onMouseEnter={playHover}
        >
          <div className="music-album-card-img">
            {album.cover ? (
              <img src={album.cover} alt={album.name} />
            ) : (
              <div className="music-album-card-placeholder">
                <img src="./assets/icons/Music.png" alt="" style={{ width: 48, height: 48, opacity: 0.4 }} />
              </div>
            )}
            <button
              className="music-album-play-btn"
              onClick={(e) => { e.stopPropagation(); if (onPlayAlbum) onPlayAlbum(album.tracks, false) }}
              title="Play Album"
            >
              ▶
            </button>
          </div>
          <div className="music-album-card-info">
            <span className="music-album-card-name">{album.name}</span>
            <span className="music-album-card-artist">{album.artist}</span>
            {album.year > 0 && <span className="music-album-card-year">{album.year}</span>}
          </div>
        </div>
      ))}
      {filteredAlbums.length === 0 && (
        <div className="music-empty-state">No albums found</div>
      )}
    </div>
  )

  const renderSongsView = () => (
    <div className="music-songs-view" ref={scrollRef}>
      {renderTrackList(filteredPlaylist, true, true)}
      {filteredPlaylist.length === 0 && (
        <div className="music-empty-state">No songs found</div>
      )}
    </div>
  )

  const renderGenresView = () => (
    <div className="music-genres-view" ref={scrollRef}>
      {genres.map(genre => (
        <div
          key={genre.name}
          className="music-genre-card"
          onClick={() => { playSelect(); setGenreFilter(genreFilter === genre.name ? '' : genre.name) }}
          onMouseEnter={playHover}
        >
          <div className="music-genre-card-icon">♫</div>
          <div className="music-genre-card-info">
            <span className="music-genre-card-name">{genre.name}</span>
            <span className="music-genre-card-count">{genre.tracks.length} tracks</span>
          </div>
        </div>
      ))}
      {genres.length === 0 && (
        <div className="music-empty-state">No genres found</div>
      )}
    </div>
  )

  const renderPlaylistsView = () => (
    <div className="music-playlists-view" ref={scrollRef}>
      <div
        className="music-playlist-create-card"
        onClick={() => { playSelect(); setShowNewPlaylist(true) }}
        onMouseEnter={playHover}
      >
        <div className="music-playlist-create-icon">+</div>
        <span className="music-playlist-create-label">New Playlist</span>
      </div>
      {playlists.map(pl => (
        <div
          key={pl.id}
          className={`music-playlist-card ${selectedPlaylist?.id === pl.id ? 'selected' : ''}`}
          onClick={() => { playSelect(); setSelectedPlaylist(pl) }}
          onMouseEnter={playHover}
        >
          <div className="music-playlist-card-img">
            {pl.tracks.length > 0 && getTrackByPath(pl.tracks[0])?.cover ? (
              <img src={getTrackByPath(pl.tracks[0]).cover} alt="" />
            ) : (
              <div className="music-playlist-card-placeholder">♫</div>
            )}
          </div>
          <div className="music-playlist-card-info">
            <span className="music-playlist-card-name">{pl.name}</span>
            <span className="music-playlist-card-count">{pl.tracks.length} tracks</span>
          </div>
        </div>
      ))}
      {playlists.length === 0 && !showNewPlaylist && (
        <div className="music-empty-state">No playlists yet. Create one!</div>
      )}
    </div>
  )

  const renderSmartMixesView = () => (
    <div className="music-smart-mixes-view" ref={scrollRef}>
      <div className="music-smart-mix-section">
        <h3 className="music-smart-mix-title">Most Played</h3>
        {smartMixes.mostPlayed.length > 0 ? (
          renderTrackList(smartMixes.mostPlayed, true, true)
        ) : (
          <div className="music-empty-state-small">Play some tracks to see your most played</div>
        )}
      </div>
      <div className="music-smart-mix-section">
        <h3 className="music-smart-mix-title">Forgotten Favorites</h3>
        {smartMixes.forgotten.length > 0 ? (
          renderTrackList(smartMixes.forgotten, true, true)
        ) : (
          <div className="music-empty-state-small">All tracks have been played recently</div>
        )}
      </div>
      <div className="music-smart-mix-section">
        <h3 className="music-smart-mix-title">Recently Played</h3>
        {smartMixes.recent.length > 0 ? (
          renderTrackList(smartMixes.recent, true, true)
        ) : (
          <div className="music-empty-state-small">No tracks played yet</div>
        )}
      </div>
    </div>
  )

  const renderRecentlyAddedView = () => (
    <div className="music-songs-view" ref={scrollRef}>
      {renderTrackList(recentlyAddedTracks, true, true)}
      {recentlyAddedTracks.length === 0 && (
        <div className="music-empty-state">No recently added tracks</div>
      )}
    </div>
  )

  const renderFavoritesView = () => (
    <div className="music-songs-view" ref={scrollRef}>
      {renderTrackList(favoriteTracks, true, true)}
      {favoriteTracks.length === 0 && (
        <div className="music-empty-state">No favorite tracks. Heart some tracks to add them here!</div>
      )}
    </div>
  )

  const renderPlaylistDetail = () => {
    if (!selectedPlaylist) return null
    const tracks = selectedPlaylist.tracks.map(getTrackByPath).filter(Boolean)
    return (
      <div className="music-playlist-detail">
        <div className="music-playlist-detail-header">
          <button className="music-back-btn" onClick={() => setSelectedPlaylist(null)}>← Back</button>
          <h2 className="music-playlist-detail-title">{selectedPlaylist.name}</h2>
          <span className="music-playlist-detail-count">{tracks.length} tracks</span>
          <div className="music-playlist-detail-actions">
            <button className="music-action-btn" onClick={() => { if (onPlayAlbum) onPlayAlbum(tracks, false) }}>▶ Play</button>
            <button className="music-action-btn" onClick={() => { if (onPlayAlbum) onPlayAlbum(tracks, true) }}>🔀 Shuffle</button>
          </div>
        </div>
        {renderTrackList(tracks, true, false)}
      </div>
    )
  }

  const renderAlbumDetail = () => {
    if (!selectedAlbum) return null
    return (
      <div className="music-album-detail">
        <div className="music-album-detail-header">
          <button className="music-back-btn" onClick={() => setSelectedAlbum(null)}>← Back</button>
          <div className="music-album-detail-cover">
            {selectedAlbum.cover ? (
              <img src={selectedAlbum.cover} alt={selectedAlbum.name} />
            ) : (
              <div className="music-album-detail-placeholder">♫</div>
            )}
          </div>
          <div className="music-album-detail-info">
            <h2 className="music-album-detail-title">{selectedAlbum.name}</h2>
            <span className="music-album-detail-artist">{selectedAlbum.artist}</span>
            {selectedAlbum.year > 0 && <span className="music-album-detail-year">{selectedAlbum.year}</span>}
            <span className="music-album-detail-duration">{formatDuration(selectedAlbum.totalDuration)}</span>
            <span className="music-album-detail-count">{selectedAlbum.tracks.length} tracks</span>
            <div className="music-album-detail-actions">
              <button className="music-action-btn" onClick={() => { if (onPlayAlbum) onPlayAlbum(selectedAlbum.tracks, false) }}>▶ Play Album</button>
              <button className="music-action-btn" onClick={() => { if (onPlayAlbum) onPlayAlbum(selectedAlbum.tracks, true) }}>🔀 Shuffle Album</button>
            </div>
          </div>
        </div>
        {renderTrackList(selectedAlbum.tracks, false, false)}
      </div>
    )
  }

  const renderArtistDetail = () => {
    if (!selectedArtist) return null
    const artistAlbums = new Map()
    selectedArtist.tracks.forEach(t => {
      const key = t.album || 'Unknown Album'
      if (!artistAlbums.has(key)) artistAlbums.set(key, { name: key, tracks: [], cover: '' })
      const alb = artistAlbums.get(key)
      alb.tracks.push(t)
      if (!alb.cover && t.cover) alb.cover = t.cover
    })
    return (
      <div className="music-artist-detail">
        <div className="music-artist-detail-header">
          <button className="music-back-btn" onClick={() => setSelectedArtist(null)}>← Back</button>
          <h2 className="music-artist-detail-title">{selectedArtist.name}</h2>
          <span className="music-artist-detail-count">{selectedArtist.tracks.length} tracks, {artistAlbums.size} albums</span>
        </div>
        {[...artistAlbums.values()].map(album => (
          <div key={album.name} className="music-artist-album-section">
            <h3 className="music-artist-album-title">{album.name}</h3>
            {renderTrackList(album.tracks, false, false)}
          </div>
        ))}
      </div>
    )
  }

  const renderContent = () => {
    if (selectedArtist) return renderArtistDetail()
    if (selectedAlbum) return renderAlbumDetail()
    if (selectedPlaylist) return renderPlaylistDetail()

    switch (view) {
      case 'artists': return renderArtistsView()
      case 'albums': return renderAlbumsView()
      case 'songs': return renderSongsView()
      case 'genres': return renderGenresView()
      case 'playlists': return renderPlaylistsView()
      case 'smartMixes': return renderSmartMixesView()
      case 'recentlyAdded': return renderRecentlyAddedView()
      case 'favorites': return renderFavoritesView()
      default: return renderSongsView()
    }
  }

  const sortOptions = SORT_OPTIONS[view] || SORT_OPTIONS.songs

  const viewTitle = {
    artists: 'Artists',
    albums: 'Albums',
    songs: 'Songs',
    genres: 'Genres',
    playlists: 'Playlists',
    smartMixes: 'Smart Mixes',
    recentlyAdded: 'Recently Added',
    favorites: 'Favorites',
  }[view] || 'My Music'

  return createPortal(
    <div className={`collection-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="collection-container" onClick={e => e.stopPropagation()}>
        <div className="collection-topbar">
          <div className="collection-filters">
            <div className="collection-chips">
              {[
                { id: 'songs', label: 'Songs' },
                { id: 'artists', label: 'Artists' },
                { id: 'albums', label: 'Albums' },
                { id: 'genres', label: 'Genres' },
                { id: 'playlists', label: 'Playlists' },
                { id: 'smartMixes', label: 'Smart Mixes' },
                { id: 'recentlyAdded', label: 'Recently Added' },
                { id: 'favorites', label: 'Favorites' },
              ].map(chip => (
                <button
                  key={chip.id}
                  className={`collection-chip ${view === chip.id ? 'active' : ''}`}
                  onClick={() => {
                    playSelect()
                    setView(chip.id)
                    setSearch('')
                    setSelectedLetter('')
                    setSelectedArtist(null)
                    setSelectedAlbum(null)
                    setSelectedPlaylist(null)
                    setGenreFilter('')
                    setFormatFilter('')
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="collection-title-area">
            <h2 className="collection-title">{viewTitle}</h2>
            <span className="collection-count">
              {view === 'artists' ? `${filteredArtists.length} artists` :
               view === 'albums' ? `${filteredAlbums.length} albums` :
               view === 'genres' ? `${genres.length} genres` :
               view === 'playlists' ? `${playlists.length} playlists` :
               `${filteredPlaylist.length} tracks`}
            </span>
          </div>
          <button className="collection-close" onClick={handleClose}>✕</button>
        </div>

        <div className="collection-secondary-filters">
          <div className="collection-dropdown-group">
            <label className="collection-dropdown-label">Search</label>
            <input
              type="text"
              className="collection-dropdown"
              placeholder="Search artist, album, track..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 220 }}
            />
          </div>

          {sortOptions.length > 0 && (
            <div className="collection-dropdown-group">
              <label className="collection-dropdown-label">Sort by</label>
              <select
                className="collection-dropdown"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {view === 'songs' && (
            <>
              <div className="collection-dropdown-group">
                <label className="collection-dropdown-label">Genre</label>
                <select
                  className="collection-dropdown"
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                >
                  <option value="">All genres</option>
                  {allGenres.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="collection-dropdown-group">
                <label className="collection-dropdown-label">Format</label>
                <select
                  className="collection-dropdown"
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                >
                  <option value="">All formats</option>
                  {allFormats.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {view === 'songs' && (
            <div className="collection-dropdown-group">
              <label className="collection-dropdown-label">View</label>
              <select
                className="collection-dropdown"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
              >
                <option value="list">List</option>
                <option value="grid">Grid</option>
              </select>
            </div>
          )}
        </div>

        <div className="music-collection-body">
          {renderContent()}
        </div>
      </div>

      {renderContextMenu()}

      {showNewPlaylist && createPortal(
        <div className="modal-overlay" onClick={() => setShowNewPlaylist(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>New Playlist</h2>
            <label>Playlist Name</label>
            <input
              type="text"
              placeholder="My Playlist"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist() }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowNewPlaylist(false)}>Cancel</button>
              <button className="modal-btn confirm" onClick={createPlaylist}>Create</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {trackInfo && createPortal(
        <div className="modal-overlay" onClick={() => setTrackInfo(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>File Info</h2>
            <div className="music-file-info">
              <div className="music-file-info-row"><span>Name</span><span>{trackInfo.name}</span></div>
              <div className="music-file-info-row"><span>Artist</span><span>{trackInfo.artist || 'Unknown'}</span></div>
              <div className="music-file-info-row"><span>Album</span><span>{trackInfo.album || 'Unknown'}</span></div>
              <div className="music-file-info-row"><span>Genre</span><span>{trackInfo.genre || 'Unknown'}</span></div>
              <div className="music-file-info-row"><span>Duration</span><span>{formatDuration(trackInfo.duration)}</span></div>
              <div className="music-file-info-row"><span>Format</span><span>{getFileFormat(trackInfo.path)}</span></div>
              <div className="music-file-info-row"><span>Plays</span><span>{playCounts[trackInfo.path] || 0}</span></div>
              <div className="music-file-info-row"><span>Path</span><span className="music-file-info-path">{trackInfo.path}</span></div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setTrackInfo(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  )
}
