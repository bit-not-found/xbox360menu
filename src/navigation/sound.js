const selectAudio = new Audio('./assets/audio/Select.mp3')
const backAudio = new Audio('./assets/audio/Back.mp3')

function play(audio) {
  try {
    audio.currentTime = 0
    const promise = audio.play()
    if (promise && typeof promise.catch === 'function') promise.catch(() => {})
  } catch {
    /* noop */
  }
}

export function playSelectSound() {
  play(selectAudio)
}

export function playBackSound() {
  play(backAudio)
}
