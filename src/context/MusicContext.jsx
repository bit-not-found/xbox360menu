import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

const MusicContext = createContext()

export const useMusic = () => useContext(MusicContext)

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MusicProvider({ children }) {
  const [playlist, setPlaylistState] = useState([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [isQueueMode, setIsQueueMode] = useState(false)

  const audioRef = useRef(null)
  const nextAudioRef = useRef(null)
  const seekingRef = useRef(false)

  // Web Audio API for visualizer
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const audioContextConnectedRef = useRef(false)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.8
    }
    return audioContextRef.current
  }, [])

  const getAnalyser = useCallback(() => {
    getAudioContext()
    return analyserRef.current
  }, [getAudioContext])

  const connectAudioSource = useCallback(() => {
    if (!audioRef.current || audioContextConnectedRef.current) return
    try {
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') ctx.resume()
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current)
      }
      sourceNodeRef.current.connect(analyserRef.current)
      analyserRef.current.connect(ctx.destination)
      audioContextConnectedRef.current = true
    } catch (e) {
      console.warn('Failed to connect audio source for visualizer:', e)
    }
  }, [getAudioContext])

  const currentTrack = (() => {
    if (isQueueMode && queue.length > 0 && queueIndex >= 0) {
      return queue[queueIndex]
    }
    if (!isQueueMode && currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
      return playlist[currentTrackIndex]
    }
    return null
  })()

  const setPlaylist = useCallback((newVal) => {
    setPlaylistState(prev => {
      const next = typeof newVal === 'function' ? newVal(prev) : newVal
      return next
    })
  }, [])

  const play = useCallback((indexOrTrack) => {
    setIsQueueMode(false)
    setQueue([])
    setQueueIndex(-1)
    if (typeof indexOrTrack === 'number') {
      if (indexOrTrack >= 0 && indexOrTrack < playlist.length) {
        setCurrentTrackIndex(indexOrTrack)
        setIsPlaying(true)
      }
    } else if (indexOrTrack && indexOrTrack.url) {
      const idx = playlist.findIndex(t => t.id === indexOrTrack.id)
      if (idx !== -1) {
        setCurrentTrackIndex(idx)
        setIsPlaying(true)
      } else {
        setPlaylistState(prev => {
          const next = [...prev, indexOrTrack]
          setCurrentTrackIndex(next.length - 1)
          setIsPlaying(true)
          return next
        })
      }
    }
  }, [playlist.length])

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause()
    setIsPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (!isQueueMode && currentTrackIndex === -1 && playlist.length > 0) {
        setCurrentTrackIndex(0)
        setIsPlaying(true)
      } else if (isQueueMode && queueIndex === -1 && queue.length > 0) {
        setQueueIndex(0)
        setIsPlaying(true)
      } else {
        audioRef.current.play().catch(() => {})
        setIsPlaying(true)
      }
    }
  }, [isPlaying, currentTrackIndex, playlist.length, isQueueMode, queueIndex, queue.length])

  const next = useCallback(() => {
    if (isQueueMode) {
      if (queue.length === 0) return
      const nextIdx = queueIndex + 1
      if (nextIdx < queue.length) {
        setQueueIndex(nextIdx)
        setIsPlaying(true)
      } else {
        setIsPlaying(false)
        setQueueIndex(-1)
        setIsQueueMode(false)
      }
    } else {
      if (playlist.length === 0) return
      setCurrentTrackIndex(prev => (prev + 1) % playlist.length)
      setIsPlaying(true)
    }
  }, [isQueueMode, queue.length, queueIndex, playlist.length])

  const prev = useCallback(() => {
    if (isQueueMode) {
      if (queue.length === 0) return
      setQueueIndex(prev => prev <= 0 ? 0 : prev - 1)
      setIsPlaying(true)
    } else {
      if (playlist.length === 0) return
      setCurrentTrackIndex(prev => prev <= 0 ? playlist.length - 1 : prev - 1)
      setIsPlaying(true)
    }
  }, [isQueueMode, queue.length, queueIndex, playlist.length])

  const seek = useCallback((time) => {
    if (audioRef.current) {
      seekingRef.current = true
      audioRef.current.currentTime = time
      setCurrentTime(time)
      setTimeout(() => { seekingRef.current = false }, 100)
    }
  }, [])

  const setVolume = useCallback((val) => {
    setVolumeState(val)
    if (audioRef.current) audioRef.current.volume = val
    if (val > 0 && isMuted) {
      setIsMuted(false)
      if (audioRef.current) audioRef.current.muted = false
    }
  }, [isMuted])

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }, [isMuted])

  const playTrackByName = useCallback((filePath) => {
    setIsQueueMode(false)
    setQueue([])
    setQueueIndex(-1)
    const idx = playlist.findIndex(t => t.path === filePath || t.id === filePath)
    if (idx !== -1) {
      play(idx)
    } else {
      const track = typeof filePath === 'object' ? filePath : null
      if (track) play(track)
    }
  }, [playlist, play])

  const addToQueue = useCallback((tracks) => {
    const trackArray = Array.isArray(tracks) ? tracks : [tracks]
    setQueue(prev => [...prev, ...trackArray])
    if (!isQueueMode && !isPlaying) {
      setIsQueueMode(true)
      setQueueIndex(0)
      setIsPlaying(true)
    }
  }, [isQueueMode, isPlaying])

  const playNext = useCallback((tracks) => {
    const trackArray = Array.isArray(tracks) ? tracks : [tracks]
    setQueue(prev => {
      const insertAt = isQueueMode ? queueIndex + 1 : 0
      const newQueue = [...prev]
      newQueue.splice(insertAt, 0, ...trackArray)
      return newQueue
    })
    if (!isQueueMode) {
      setIsQueueMode(true)
      setQueueIndex(0)
      setIsPlaying(true)
    }
  }, [isQueueMode, queueIndex])

  const clearQueue = useCallback(() => {
    setQueue([])
    setQueueIndex(-1)
    setIsQueueMode(false)
  }, [])

  const playAlbum = useCallback((albumTracks, shuffle = false) => {
    let ordered = [...albumTracks]
    if (shuffle) {
      ordered = ordered.sort(() => Math.random() - 0.5)
    }
    setQueue(ordered)
    setQueueIndex(0)
    setIsQueueMode(true)
    setIsPlaying(true)
  }, [])

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Load + play current track
  useEffect(() => {
    const audio = audioRef.current
    const track = isQueueMode
      ? (queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null)
      : (currentTrackIndex >= 0 && currentTrackIndex < playlist.length ? playlist[currentTrackIndex] : null)

    if (!audio || !track) {
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
      setCurrentTime(0)
      setDuration(0)
      return
    }

    audio.src = track.url
    audio.load()
    if (isPlaying) {
      audio.play().catch(() => {})
    }
  }, [currentTrackIndex, isQueueMode, queueIndex])

  // Preload next track for gapless playback
  useEffect(() => {
    if (nextAudioRef.current) {
      let nextTrack = null
      if (isQueueMode) {
        const nextIdx = queueIndex + 1
        if (nextIdx < queue.length) nextTrack = queue[nextIdx]
      } else {
        const nextIdx = currentTrackIndex + 1
        if (nextIdx < playlist.length) nextTrack = playlist[nextIdx]
      }
      if (nextTrack) {
        nextAudioRef.current.src = nextTrack.url
        nextAudioRef.current.load()
      }
    }
  }, [currentTrackIndex, queueIndex, playlist, queue, isQueueMode])

  // Sync playing state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      connectAudioSource()
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, connectAudioSource])

  const handleEnded = useCallback(() => {
    next()
  }, [next])

  const handleTimeUpdate = useCallback(() => {
    if (!seekingRef.current && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [])

  const value = {
    playlist, setPlaylist,
    currentTrack, currentTrackIndex, setCurrentTrackIndex,
    isPlaying,
    currentTime, duration,
    volume, isMuted,
    formatTime,
    play, pause, togglePlay, next, prev, seek,
    setVolume, toggleMute, playTrackByName,
    queue, queueIndex, isQueueMode,
    addToQueue, playNext, clearQueue, playAlbum,
    audioRef, nextAudioRef,
    handleEnded, handleTimeUpdate, handleLoadedMetadata,
    getAudioContext, getAnalyser, connectAudioSource,
  }

  return (
    <MusicContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <audio ref={nextAudioRef} preload="auto" />
    </MusicContext.Provider>
  )
}
