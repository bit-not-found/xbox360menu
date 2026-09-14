import { useRef, useEffect } from 'react'

export default function IntroVideo({ onFinished }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    // Failsafe: skip after 12s no matter what
    const timer = setTimeout(onFinished, 12000)

    const handleEnded = () => onFinished()
    const handleError = () => onFinished()

    v.addEventListener('ended', handleEnded)
    v.addEventListener('error', handleError)

    // Start muted (always allowed), then unmute
    v.muted = true
    v.play().then(() => {
      v.muted = false
    }).catch(() => {
      onFinished()
    })

    return () => {
      clearTimeout(timer)
      v.removeEventListener('ended', handleEnded)
      v.removeEventListener('error', handleError)
      v.pause()
      v.src = ''
      v.load()
    }
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 100,
      background: '#000',
    }}>
      <video
        ref={videoRef}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      >
        <source src="./assets/intro.mp4" type="video/mp4" />
      </video>
    </div>
  )
}


