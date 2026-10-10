const MAX_DELTA = 0.1

export interface LoopOptions {
  fpsCap?: number
  pauseOnHidden?: boolean
}

export class Loop {
  private rafId = 0
  private lastTime = 0
  private started = false
  private manuallyPaused = false
  private hidden = false
  private fpsCap: number

  constructor(
    private readonly update: (delta: number) => void,
    options: LoopOptions = {},
  ) {
    this.fpsCap = options.fpsCap ?? 60
    if (options.pauseOnHidden !== false && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange)
    }
  }

  private onVisibilityChange = (): void => {
    this.hidden = document.hidden
  }

  get isRunning(): boolean {
    return this.started && !this.manuallyPaused && !this.hidden
  }

  get isPaused(): boolean {
    return this.manuallyPaused
  }

  setFpsCap(fps: number): void {
    if (!Number.isFinite(fps) || fps <= 0) return
    this.fpsCap = fps
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.lastTime = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.lastTime = 0
  }

  pause(): void {
    this.manuallyPaused = true
  }

  resume(): void {
    this.manuallyPaused = false
  }

  private tick = (now: number): void => {
    this.rafId = requestAnimationFrame(this.tick)
    if (this.manuallyPaused || this.hidden) {
      this.lastTime = now
      return
    }
    if (this.lastTime === 0) {
      this.lastTime = now
      return
    }
    const frameInterval = 1000 / this.fpsCap
    const elapsed = now - this.lastTime
    if (elapsed < frameInterval - 0.5) return
    this.lastTime = now
    const delta = Math.min(elapsed / 1000, MAX_DELTA)
    this.update(delta)
  }

  dispose(): void {
    this.stop()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange)
    }
  }
}
