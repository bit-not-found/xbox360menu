import { Engine } from './engine/Engine'
import { Turntable } from './engine/Turntable'
import type { QualityProfile } from './engine/Quality'
import type { RendererStats } from './engine/Disposer'
import { loadVRM, VrmLoadError, type VrmSource } from './avatar/VrmLoader'
import { Avatar } from './avatar/Avatar'
import type { ExpressionName } from './avatar/Expressions'
import type { PoseName } from './avatar/Animator'

const BASE = import.meta.env.BASE_URL || '/'
const PLACEHOLDER_URL = `${BASE}assets/avatar/placeholder.vrm`
const IDLE_URL = `${BASE}assets/avatar/animations/idle.vrma`

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface AvatarWorldOptions {
  source?: VrmSource
  usePlaceholder?: boolean
  quality?: QualityProfile
  onStatus?: (status: LoadStatus, detail?: string) => void
  onError?: (error: VrmLoadError | Error) => void
  onContextLost?: () => void
  onContextRestored?: () => void
}

export interface AvatarWorldHandle {
  readonly engine: Engine
  load(source: VrmSource): Promise<void>
  loadPlaceholder(): Promise<void>
  setExpression(name: ExpressionName, weight: number): void
  resetExpressions(): void
  setMouth(value01: number): void
  setPose(name: PoseName): Promise<boolean>
  setQuality(profile: QualityProfile): void
  setSpringBonesEnabled(enabled: boolean): void
  captureThumbnail(width?: number, height?: number): Promise<Blob | null>
  getStats(): RendererStats
  dispose(): void
}

export async function mount(
  container: HTMLElement,
  options: AvatarWorldOptions = {},
): Promise<AvatarWorldHandle> {
  const engine = new Engine(container, {
    quality: options.quality,
    autoStart: true,
    onContextLost: options.onContextLost,
    onContextRestored: options.onContextRestored,
  })

  let current: Avatar | null = null
  let loadToken = 0
  let disposed = false

  const turntable = new Turntable(engine.camera, engine.renderer.domElement, {
    onPointer: (x, y) => current?.lookAt.setPointer(x, y),
  })

  const removeUpdatable = engine.addUpdatable((delta) => {
    turntable.update(delta)
    current?.update(delta)
  })

  function report(status: LoadStatus, detail?: string): void {
    options.onStatus?.(status, detail)
  }

  function reportError(error: VrmLoadError | Error): void {
    report('error', error.message)
    options.onError?.(error)
  }

  async function install(vrm: Awaited<ReturnType<typeof loadVRM>>): Promise<void> {
    if (disposed) {
      vrm.scene.parent?.remove(vrm.scene)
      return
    }
    const previous = current
    const avatar = new Avatar(vrm, engine.scene)
    engine.scene.add(avatar.root)
    turntable.frame(avatar.root)
    current = avatar

    if (previous) {
      previous.dispose()
    }

    await avatar.animator.load('idle', IDLE_URL)
    avatar.animator.play('idle')
  }

  async function load(source: VrmSource): Promise<void> {
    const token = ++loadToken
    report('loading')
    try {
      const vrm = await loadVRM(source)
      if (token !== loadToken) return
      await install(vrm)
      if (token !== loadToken) return
      report('ready')
    } catch (error) {
      if (token !== loadToken) return
      reportError(error instanceof Error ? error : new Error('Failed to load avatar.'))
      throw error
    }
  }

  async function loadPlaceholder(): Promise<void> {
    try {
      await load(PLACEHOLDER_URL)
    } catch {
      /* placeholder failure is surfaced through onStatus/onError */
    }
  }

  engine.start()

  if (options.source) {
    load(options.source).catch(() => {})
  } else if (options.usePlaceholder !== false) {
    loadPlaceholder()
  }

  return {
    engine,
    load,
    loadPlaceholder,
    setExpression: (name, weight) => current?.expressions.setExpression(name, weight),
    resetExpressions: () => current?.expressions.resetExpressions(),
    setMouth: (value) => current?.expressions.setMouth(value),
    setPose: async (name) => {
      if (!current) return false
      return current.animator.play(name)
    },
    setQuality: (profile) => engine.setQuality(profile),
    setSpringBonesEnabled: (enabled) => current?.setSpringBonesEnabled(enabled),
    captureThumbnail: (width, height) => engine.captureThumbnail(width, height),
    getStats: () => engine.getStats(),
    dispose: () => {
      if (disposed) return
      disposed = true
      loadToken++
      removeUpdatable()
      current?.dispose()
      current = null
      turntable.dispose()
      engine.dispose()
    },
  }
}

export function unmount(handle: AvatarWorldHandle | null | undefined): void {
  handle?.dispose()
}
