import * as THREE from 'three'
import { VRMUtils, type VRM, type VRMSpringBoneJoint } from '@pixiv/three-vrm'
import { Animator } from './Animator'
import { Expressions } from './Expressions'
import { LookAt } from './LookAt'

export class Avatar {
  readonly vrm: VRM
  readonly root: THREE.Group
  readonly mixer: THREE.AnimationMixer
  readonly expressions: Expressions
  readonly animator: Animator
  readonly lookAt: LookAt

  private springBonesEnabled = true
  private detachedJoints: VRMSpringBoneJoint[] = []

  constructor(vrm: VRM, scene: THREE.Scene) {
    this.vrm = vrm
    this.root = vrm.scene
    this.mixer = new THREE.AnimationMixer(vrm.scene)
    this.expressions = new Expressions(vrm)
    this.animator = new Animator(vrm, this.mixer)
    this.lookAt = new LookAt(vrm, scene)
  }

  update(delta: number): void {
    this.animator.update(delta)
    this.expressions.update(delta)
    this.vrm.update(delta)
  }

  setSpringBonesEnabled(enabled: boolean): void {
    const manager = this.vrm.springBoneManager
    if (!manager || this.springBonesEnabled === enabled) return
    this.springBonesEnabled = enabled
    if (enabled) {
      for (const joint of this.detachedJoints) manager.addJoint(joint)
      this.detachedJoints = []
    } else {
      this.detachedJoints = Array.from(manager.joints)
      for (const joint of this.detachedJoints) manager.deleteJoint(joint)
    }
  }

  dispose(): void {
    this.animator.dispose()
    this.lookAt.dispose()
    if (this.root.parent) this.root.parent.remove(this.root)
    VRMUtils.deepDispose(this.root)
  }
}
