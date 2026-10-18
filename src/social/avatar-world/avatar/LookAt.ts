import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'

const DEFAULT_LOOK_SPEED = 6

export class LookAt {
  readonly target: THREE.Object3D
  private readonly headHeight: number
  private readonly desired = new THREE.Vector3()
  private lerpSpeed = DEFAULT_LOOK_SPEED
  private enabled: boolean

  constructor(
    private readonly vrm: VRM,
    private readonly scene: THREE.Scene,
  ) {
    this.target = new THREE.Object3D()
    this.headHeight = this.measureHeadHeight()
    this.desired.set(0, this.headHeight, 1.6)
    this.target.position.copy(this.desired)
    scene.add(this.target)

    if (vrm.lookAt) {
      vrm.lookAt.autoUpdate = true
      vrm.lookAt.target = this.target
      this.enabled = true
    } else {
      this.enabled = false
    }
  }

  get defaultHeight(): number {
    return this.headHeight
  }

  private measureHeadHeight(): number {
    const head = this.vrm.humanoid.getNormalizedBoneNode('head')
    if (!head) return 1.4
    this.vrm.scene.updateMatrixWorld(true)
    return new THREE.Vector3().setFromMatrixPosition(head.matrixWorld).y || 1.4
  }

  setEnabled(enabled: boolean): void {
    if (!this.vrm.lookAt) return
    this.enabled = enabled
    this.vrm.lookAt.autoUpdate = enabled
  }

  /** Aim at a normalized screen position (−1..1); the applied target eases toward it. */
  setPointer(normalizedX: number, normalizedY: number, speed = DEFAULT_LOOK_SPEED): void {
    if (!this.enabled) return
    const x = Math.max(-1, Math.min(1, normalizedX))
    const y = Math.max(-1, Math.min(1, normalizedY))
    this.lerpSpeed = speed
    this.desired.set(x * 0.9, this.headHeight + y * 0.5, 1.6)
  }

  /** Aim at an explicit world-space point (dashboard tiles, saccades, …). */
  lookAtWorld(point: THREE.Vector3, speed = DEFAULT_LOOK_SPEED): void {
    if (!this.enabled) return
    this.lerpSpeed = speed
    this.desired.copy(point)
  }

  /** Ease the live target toward the desired point; call every frame. */
  update(delta: number): void {
    if (!this.enabled) return
    const blend = 1 - Math.exp(-this.lerpSpeed * delta)
    this.target.position.lerp(this.desired, blend)
  }

  reset(): void {
    this.desired.set(0, this.headHeight, 1.6)
    this.target.position.copy(this.desired)
    this.lerpSpeed = DEFAULT_LOOK_SPEED
  }

  dispose(): void {
    if (this.vrm.lookAt && this.vrm.lookAt.target === this.target) {
      this.vrm.lookAt.target = null
    }
    this.scene.remove(this.target)
  }
}
