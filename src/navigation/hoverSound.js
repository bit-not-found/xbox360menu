const hoverAudio = new Audio('./assets/audio/hover.mp3')

let lastPlayAt = 0
let blockedUntil = 0
const MIN_GAP = 90

export function playHoverSound() {
  const now = performance.now()
  if (now < blockedUntil) return
  if (now - lastPlayAt < MIN_GAP) return
  lastPlayAt = now
  try {
    hoverAudio.currentTime = 0
    const p = hoverAudio.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
    /* noop */
  }
}

export function blockHoverSound(ms = 180) {
  blockedUntil = performance.now() + ms
}
