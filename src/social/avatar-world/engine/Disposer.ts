import * as THREE from 'three'

type Disposable = { dispose: () => void }

export class Disposer {
  private resources = new Set<Disposable>()
  private disposed = false

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      resource.dispose()
      return resource
    }
    this.resources.add(resource)
    return resource
  }

  untrack(resource: Disposable): void {
    this.resources.delete(resource)
  }

  get size(): number {
    return this.resources.size
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const resource of this.resources) {
      try {
        resource.dispose()
      } catch {
        /* a single bad resource must not block the rest */
      }
    }
    this.resources.clear()
  }
}

export interface RendererStats {
  geometries: number
  textures: number
  programs: number
}

export function readRendererInfo(renderer: THREE.WebGLRenderer): RendererStats {
  const info = renderer.info
  return {
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length ?? 0,
  }
}
