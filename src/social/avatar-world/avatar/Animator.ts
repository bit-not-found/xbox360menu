import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { VRM } from '@pixiv/three-vrm'
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation'

export type PoseName = 'idle' | 'walk' | 'wave'

export interface PlayOptions {
  fade?: number
  loop?: boolean
}

export class Animator {
  private readonly loader: GLTFLoader
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null
  private oneShot: { action: THREE.AnimationAction; onFinished: () => void } | null = null

  private readonly onMixerFinished = (event: { action: THREE.AnimationAction }): void => {
    if (!this.oneShot || event.action !== this.oneShot.action) return
    const callback = this.oneShot.onFinished
    this.oneShot = null
    callback()
  }

  constructor(
    private readonly vrm: VRM,
    private readonly mixer: THREE.AnimationMixer,
  ) {
    this.loader = new GLTFLoader()
    this.loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
    this.mixer.addEventListener('finished', this.onMixerFinished)
  }

  get currentName(): string | null {
    for (const [name, action] of this.actions) {
      if (action === this.current) return name
    }
    return null
  }

  has(name: string): boolean {
    return this.actions.has(name)
  }

  async load(name: string, url: string): Promise<boolean> {
    if (this.actions.has(name)) return true
    try {
      const gltf = await this.loader.loadAsync(url)
      const animations = (gltf.userData as { vrmAnimations?: VRMAnimation[] }).vrmAnimations
      if (!animations || animations.length === 0) return false
      const clip = createVRMAnimationClip(animations[0], this.vrm)
      const action = this.mixer.clipAction(clip)
      this.actions.set(name, action)
      return true
    } catch {
      return false
    }
  }

  play(name: string, options: PlayOptions = {}): boolean {
    const next = this.actions.get(name)
    if (!next) return false
    if (this.current === next && next.isRunning()) return true

    const fade = options.fade ?? 0.3
    const loop = options.loop !== false
    next.enabled = true
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    next.clampWhenFinished = !loop
    next.reset().setEffectiveWeight(1)

    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, fade, false)
    } else {
      next.fadeIn(fade)
    }
    next.play()
    this.current = next
    return true
  }

  /** Register an already-built clip (e.g. a retargeted BVH motion) under a name. */
  addClip(name: string, clip: THREE.AnimationClip): boolean {
    if (this.actions.has(name)) return true
    if (clip.tracks.length === 0) return false
    this.actions.set(name, this.mixer.clipAction(clip))
    return true
  }

  /** Play a clip once (clamped on the last frame), then report back so the caller can return to idle. */
  playOnce(name: string, options: { fade?: number; onFinished?: () => void } = {}): boolean {
    const next = this.actions.get(name)
    if (!next) return false

    const fade = options.fade ?? 0.3
    next.enabled = true
    next.setLoop(THREE.LoopOnce, 1)
    next.clampWhenFinished = true
    next.reset().setEffectiveWeight(1)

    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, fade, false)
    } else {
      next.fadeIn(fade)
    }
    next.play()
    this.current = next

    if (options.onFinished) {
      this.oneShot = { action: next, onFinished: options.onFinished }
    }
    return true
  }

  getDuration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0
  }

  stop(fade = 0.2): void {
    if (!this.current) return
    this.current.fadeOut(fade)
    this.current = null
  }

  update(delta: number): void {
    this.mixer.update(delta)
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.onMixerFinished)
    this.oneShot = null
    this.mixer.stopAllAction()
    for (const action of this.actions.values()) {
      action.stop()
    }
    this.actions.clear()
    this.current = null
    this.mixer.uncacheRoot(this.vrm.scene)
  }
}
