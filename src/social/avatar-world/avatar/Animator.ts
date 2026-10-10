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

  constructor(
    private readonly vrm: VRM,
    private readonly mixer: THREE.AnimationMixer,
  ) {
    this.loader = new GLTFLoader()
    this.loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
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

  stop(fade = 0.2): void {
    if (!this.current) return
    this.current.fadeOut(fade)
    this.current = null
  }

  update(delta: number): void {
    this.mixer.update(delta)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    for (const action of this.actions.values()) {
      action.stop()
    }
    this.actions.clear()
    this.current = null
    this.mixer.uncacheRoot(this.vrm.scene)
  }
}
