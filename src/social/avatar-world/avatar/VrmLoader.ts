import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

export type VrmSource = ArrayBuffer | Blob | string

export type VrmErrorCode =
  | 'invalid-format'
  | 'not-vrm'
  | 'no-humanoid'
  | 'too-large'
  | 'network'
  | 'unknown'

export class VrmLoadError extends Error {
  readonly code: VrmErrorCode

  constructor(code: VrmErrorCode, message: string) {
    super(message)
    this.name = 'VrmLoadError'
    this.code = code
  }
}

export const VRM_LIMITS = {
  warnBytes: 25 * 1024 * 1024,
  rejectBytes: 100 * 1024 * 1024,
  targetBytes: 15 * 1024 * 1024,
} as const

function looksLikeGltf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false
  const view = new Uint8Array(buffer, 0, 4)
  const magic = String.fromCharCode(view[0], view[1], view[2], view[3])
  return magic === 'glTF' || view[0] === 0x7b
}

async function loadGltf(loader: GLTFLoader, source: VrmSource): Promise<GLTF> {
  try {
    if (typeof source === 'string') {
      return await loader.loadAsync(source)
    }
    const buffer = source instanceof Blob ? await source.arrayBuffer() : source
    if (!looksLikeGltf(buffer)) {
      throw new VrmLoadError('invalid-format', 'This file is not a valid glTF/VRM container.')
    }
    return await loader.parseAsync(buffer, '')
  } catch (error) {
    if (error instanceof VrmLoadError) throw error
    if (typeof source === 'string') {
      throw new VrmLoadError('network', 'Could not fetch the model. Check the URL and your connection.')
    }
    throw new VrmLoadError('unknown', error instanceof Error ? error.message : 'Failed to parse the VRM.')
  }
}

export async function loadVRM(source: VrmSource): Promise<VRM> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  const gltf = await loadGltf(loader, source)
  const vrm = gltf.userData.vrm as VRM | undefined

  if (!vrm) {
    throw new VrmLoadError('not-vrm', 'That model is a plain glTF. Import a .vrm exported from VRoid Studio.')
  }
  if (!vrm.humanoid) {
    throw new VrmLoadError('no-humanoid', 'This VRM has no humanoid rig and cannot be animated.')
  }

  VRMUtils.removeUnnecessaryVertices(vrm.scene)
  VRMUtils.combineSkeletons(vrm.scene)
  VRMUtils.rotateVRM0(vrm)

  vrm.scene.traverse((object) => {
    object.frustumCulled = false
  })

  return vrm
}
