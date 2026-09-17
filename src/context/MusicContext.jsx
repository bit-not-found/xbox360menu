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

  const audioRef = useRef(null)
  const nextAudioRef = useRef(null)
  const seekingRef = useRef(false)

  const currentTrack = currentTrackIndex >= 0 && currentTrackIndex < playlist.length
    ? playlist[currentTrackIndex]
    : null

  const setPlaylist = useCallback((newVal) => {
    setPlaylistState(prev => {
      const next = typeof newVal === 'function' ? newVal(prev) : newVal
      return next
    })
  }, [])

  const play = useCallback((indexOrTrack) => {
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
      if (currentTrackIndex === -1 && playlist.length > 0) {
        setCurrentTrackIndex(0)
        setIsPlaying(true)
      } else {
        audioRef.current.play().catch(() => {})
        setIsPlaying(true)
      }
    }
  }, [isPlaying, currentTrackIndex, playlist.length])

  const next = useCallback(() => {
    if (playlist.length === 0) return
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length)
    setIsPlaying(true)
  }, [playlist.length])

  const prev = useCallback(() => {
    if (playlist.length === 0) return
    setCurrentTrackIndex(prev => prev <= 0 ? playlist.length - 1 : prev - 1)
    setIsPlaying(true)
  }, [playlist.length])

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
    const idx = playlist.findIndex(t => t.path === filePath || t.id === filePath)
    if (idx !== -1) {
      play(idx)
    } else {
      const track = typeof filePath === 'object' ? filePath : null
      if (track) play(track)
    }
  }, [playlist, play])

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Load + play current track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) {
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
      setCurrentTime(0)
      setDuration(0)
      return
    }

    audio.src = currentTrack.url
    audio.load()
    if (isPlaying) {
      audio.play().catch(() => {})
    }
  }, [currentTrackIndex, currentTrack?.url])

  // Preload next track for gapless playback
  useEffect(() => {
    const nextIdx = currentTrackIndex + 1
    if (nextAudioRef.current && nextIdx < playlist.length) {
      nextAudioRef.current.src = playlist[nextIdx].url
      nextAudioRef.current.load()
    }
  }, [currentTrackIndex, playlist])

  // Sync playing state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying])

  const handleEnded = useCallback(() => {
    if (playlist.length === 0) return
    const nextIdx = (currentTrackIndex + 1) % playlist.length
    setCurrentTrackIndex(nextIdx)
    setIsPlaying(true)
  }, [currentTrackIndex, playlist.length])

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
    audioRef, nextAudioRef,
    handleEnded, handleTimeUpdate, handleLoadedMetadata,
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
