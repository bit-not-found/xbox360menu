import * as THREE from 'three'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { type VRMHumanBoneName, type VRM } from '@pixiv/three-vrm'

type HumanBoneName = `${VRMHumanBoneName}`

/**
 * Every VRM humanoid bone the pack's BVH files can drive. Eye bones are left
 * out on purpose — LookAt owns the eyes — and hips translation is dropped so
 * avatars stay planted on their stage slots.
 */
const HUMANOID_BONES: readonly HumanBoneName[] = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
  'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
  'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  'rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal',
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
]

const BONE_SET = new Set<string>(HUMANOID_BONES)
const EXCLUDED_JOINTS = new Set<string>(['hips', 'leftEye', 'rightEye', 'jaw'])

const loader = new BVHLoader()

/**
 * Load a pack .bvh (modified Mixamo rig using VRM humanoid joint names) and
 * retarget it onto the VRM's normalized bones.
 *
 * Rotations are rest-corrected: the rest frame's local quaternion is inverted
 * and pre-multiplied onto every keyframe, so the clip plays as a delta from the
 * T-pose on three-vrm's identity-rest normalized rig. Root translation is
 * intentionally discarded to keep avatars standing on their marks.
 */
export async function loadRetargetedBvhClip(url: string, vrm: VRM): Promise<THREE.AnimationClip | null> {
  let bvh: { clip: THREE.AnimationClip }
  try {
    bvh = await loader.loadAsync(url)
  } catch {
    return null
  }

  const source = bvh.clip
  const tracks: THREE.KeyframeTrack[] = []
  const scratch = new THREE.Quaternion()
  const rest = new THREE.Quaternion()

  for (const track of source.tracks) {
    const separator = track.name.lastIndexOf('.')
    if (separator < 0) continue
    const joint = track.name.slice(0, separator)
    const property = track.name.slice(separator + 1)
    if (property !== 'quaternion') continue
    if (!BONE_SET.has(joint) || EXCLUDED_JOINTS.has(joint)) continue

    const node = vrm.humanoid.getNormalizedBoneNode(joint as VRMHumanBoneName)
    if (!node) continue

    const times = track.times
    const values = track.values
    if (times.length === 0 || values.length < 4) continue

    rest.set(values[0], values[1], values[2], values[3]).invert()
    const corrected = new Float32Array(values.length)
    for (let i = 0; i < values.length; i += 4) {
      scratch.set(values[i], values[i + 1], values[i + 2], values[i + 3])
      scratch.premultiply(rest)
      if (scratch.w < 0) {
        scratch.x = -scratch.x
        scratch.y = -scratch.y
        scratch.z = -scratch.z
        scratch.w = -scratch.w
      }
      corrected[i] = scratch.x
      corrected[i + 1] = scratch.y
      corrected[i + 2] = scratch.z
      corrected[i + 3] = scratch.w
    }

    tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, corrected))
  }

  if (tracks.length === 0) return null
  return new THREE.AnimationClip(source.name || 'bvh-motion', source.duration, tracks)
}
