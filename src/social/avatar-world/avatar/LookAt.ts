import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'

export class LookAt {
  readonly target: THREE.Object3D
  private readonly headHeight: number
  private enabled: boolean

  constructor(
    private readonly vrm: VRM,
    private readonly scene: THREE.Scene,
  ) {
    this.target = new THREE.Object3D()
    this.headHeight = this.measureHeadHeight()
    this.target.position.set(0, this.headHeight, 1.6)
    scene.add(this.target)

    if (vrm.lookAt) {
      vrm.lookAt.autoUpdate = true
      vrm.lookAt.target = this.target
      this.enabled = true
    } else {
      this.enabled = false
    }
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

  setPointer(normalizedX: number, normalizedY: number): void {
    if (!this.enabled) return
    const x = Math.max(-1, Math.min(1, normalizedX))
    const y = Math.max(-1, Math.min(1, normalizedY))
    this.target.position.set(x * 0.9, this.headHeight + y * 0.5, 1.6)
  }

  reset(): void {
    this.target.position.set(0, this.headHeight, 1.6)
  }

  dispose(): void {
    if (this.vrm.lookAt && this.vrm.lookAt.target === this.target) {
      this.vrm.lookAt.target = null
    }
    this.scene.remove(this.target)
  }
}
